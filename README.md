# Askwell

A support assistant a business can put on its website. A visitor asks a question in a chat box; the assistant answers from the business's own documents, shows the passage the answer came from, and says so when the documents don't cover it.

The owner gets a private area to manage documents, read every conversation, see which questions went unanswered, and run a test set that grades the assistant's answers.

This is a portfolio project by Beki, made in collaboration with Claude, Anthropic's AI model. Beki set the brief, directed the work and tested it; Claude wrote the code. The demo runs on the help centre of Larkspur Night Line, an invented sleeper-train company.

## What it does

**For a visitor**

- Ask a question and get an answer with its source. Click the source to read the passage.
- Mark an answer helpful or not.
- When the assistant can't answer, leave an email so a person can follow up.

**For the owner**

- Add documents by uploading a PDF or text file, importing a web page, or pasting text.
- Read all conversations, filtered to the ones with an unanswered question.
- See follow-up requests and mark them as replied.
- Set the assistant's name, greeting, tone, example questions and a daily question limit.
- Copy one line of HTML to add the chat box to any website.
- Run the answer-quality tests (below).

## How an answer is made

This is retrieval-augmented generation (RAG):

1. **Chunking.** Each document is cut into passages of about 650 characters. A passage starts at each heading and keeps the heading with it, and never ends mid-sentence. ([`src/lib/chunk.ts`](src/lib/chunk.ts))
2. **Retrieval.** The question is ranked against every passage. With a database connected, Postgres returns candidates by keyword (full-text search) and by meaning (pgvector, with embeddings from the free `gte-small` model running in a Supabase edge function). The app then re-ranks the candidates with BM25 plus a bonus for close meaning matches. ([`src/lib/rank.ts`](src/lib/rank.ts), [`supabase/migrations`](supabase/migrations))
3. **Generation.** The best passages go to the model with strict rules: answer only from these passages, cite each fact, copy numbers exactly, and reply with a fixed token when the answer isn't there. The server turns that token into a decline message, so the visitor never sees a guess. ([`src/lib/answer.ts`](src/lib/answer.ts))
4. **Streaming.** The answer streams to the browser as it is written. Citations are renumbered so only the sources actually used are shown.

### Search-only mode

With no AI key configured, Askwell skips step 3 and quotes the best-matching passage word for word. It declines when the best passage covers less than 55% of the question, weighted so that rare words count for more. That is why "Can I pay with Bitcoin?" is declined even though the payments page matches "pay" and "ticket".

Search-only mode costs nothing and cannot invent anything, so it is what the public demo runs on.

### Bring your own key

A visitor or owner can paste a key for Claude, OpenAI, Gemini or Groq (or point at Ollama when running locally). The key is kept in the browser tab's session storage, sent as a header with that person's own requests, used once by the server, and never written to the database or logs. A site owner can instead set a key in the server's environment so every visitor gets model answers.

## Answer quality

The owner keeps a list of test questions. Each has the facts a correct answer must contain, or is marked "should decline". One button runs every question through the same pipeline a visitor's question takes and grades the result:

- **Correct**, **missing facts**, **declined correctly**, **declined but the answer was in the documents**, or **answered but should have declined**.
- **Grounding check.** Every number in the answer must appear in the passages it was given, and so must most of the content words of every sentence. Anything else is flagged as an unsupported claim.

The grading is deterministic, so a run is free and repeatable. Runs are saved, so the owner can see whether a document change made things better or worse. ([`src/lib/evals.ts`](src/lib/evals.ts))

On the demo documents, search-only mode passes 14 of 15. The one it misses needs facts from two different passages, which is the kind of question a model handles and a single quoted passage cannot.

## Security

- **Tenant isolation is in the database.** Every table has row-level security. An owner can read and write only rows of their own business. Application code never filters by owner as the only line of defence.
- **The public demo is read-only by policy, not by hiding buttons.** The demo business has no owner, so no policy allows writing to it. The owner area for it is open to everyone, and for that reason follow-up emails left in the demo are masked before they are stored.
- **The chat widget needs no table access.** Visitors write conversations only through a few `security definer` functions that validate their input and enforce the daily question limit.
- **The web-page importer refuses private addresses** and does not follow redirects, so it cannot be used to reach internal services (SSRF).
- **Passages are treated as data.** The prompt tells the model to ignore instructions that appear inside documents.

One known limit: the database functions the widget calls are reachable with the public key, so someone could script fake conversations up to the daily limit. A production version would add a bot check on the chat route.

## Tech

- Next.js 16 (App Router) with React 19 and TypeScript. No UI framework; the CSS is hand-written.
- Supabase: Postgres, row-level security, auth, pgvector, one edge function.
- Vitest for unit tests, Playwright for browser tests.

The data layer has two implementations behind one interface ([`src/lib/store`](src/lib/store)): Supabase, and an in-memory store seeded with the demo. With no database configured the app runs entirely on the in-memory store, which is also what the tests use.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no settings at all, the app runs the demo from memory, and you can edit the demo business in the owner area.

To use Ollama for model answers, start Ollama, open the chat's "Use your own AI key" link, and choose Ollama.

To connect a database, copy `.env.example` to `.env.local` and fill in the two Supabase values. Run `supabase/migrations/0001_init.sql` and then `supabase/seed.sql` in the Supabase SQL editor, and deploy `supabase/functions/embed`.

## Tests

```bash
npm test            # 43 unit tests: chunking, ranking, citations, grading, model streaming
npm run build
npm run test:e2e    # 28 browser tests: chat, owner area, embed script, read-only demo, phone layout
```

## What was and wasn't verified

- The in-memory mode is covered end to end by the tests above. Because a host like Vercel runs several copies of the server that share no memory, some tests send a click to a second server than the one that drew the page.
- In the read-only demo a test run is not stored on the server. It is kept in the visitor's browser and shown only to them.
- The database schema, security policies and widget functions were run and checked directly in Postgres. The embedding function is deployed and was used to embed the demo passages.
- The hosted site runs on that database, and was checked there by hand: answers (keyword plus meaning search), ratings, follow-ups, the owner pages and a full test run (14 of 15). Account sign-up has not been tried on the hosted site.
- Model mode is tested against a simulated provider (both the Claude and the OpenAI-style stream formats). It has not been run against a paid API.
- The demo's starting conversations are produced by running real questions through the search-only pipeline: at server start in memory mode, and through the live chat for the database (their times were then spread over the past day). None of them are written by hand. The saved test run in the database comes from [`scripts/demo-run-sql.ts`](scripts/demo-run-sql.ts).
