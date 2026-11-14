import Link from "next/link";
import { notFound } from "next/navigation";
import { Desk } from "@/components/landing/Desk";
import { SiteNav } from "@/components/SiteNav";
import { buildSystemPrompt } from "@/lib/answer";
import { summarise, VERDICT_LABEL } from "@/lib/evals";
import { PROVIDERS } from "@/lib/llm";
import { getChatProps } from "@/lib/public";
import { runTest } from "@/lib/run-test";
import { DEMO_SLUG } from "@/lib/session";
import { getStore } from "@/lib/store";
import { excerpt } from "@/lib/text";
import "./landing.css";

export const dynamic = "force-dynamic";

const WORKED_QUESTION = "Can I bring my dog on the train?";
const DECLINED_QUESTION = "Can I pay for my ticket with Bitcoin?";
const REPO = "https://github.com/Beki-hck/askwell";

export default async function Home() {
  const props = await getChatProps(DEMO_SLUG);
  const store = await getStore();
  const business = await store.getBusiness(DEMO_SLUG);
  if (!props || !business) notFound();

  // Everything shown below is computed from the live demo data on each request,
  // so the page cannot drift from what the product actually does.
  const [documents, tests, found, nearMiss, stats] = await Promise.all([
    store.listDocuments(business.id),
    store.listTestCases(business.id),
    store.search(business, WORKED_QUESTION, 3),
    store.search(business, DECLINED_QUESTION, 1),
    store.stats(business.id),
  ]);
  const results = await Promise.all(tests.map((t) => runTest(store, business, t, null)));
  const score = summarise(results);
  const worked = await runTest(
    store,
    business,
    { id: "", businessId: business.id, question: WORKED_QUESTION, expected: "", keyFacts: [], shouldAnswer: true },
    null,
  );
  const topScore = found[0]?.score ?? 1;
  const rules = buildSystemPrompt(business, [])
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .slice(0, 3)
    .map((line) => line.slice(2));
  const sample = [
    results.find((r) => r.verdict === "correct"),
    results.find((r) => r.verdict === "declined_correctly"),
    results.find((r) => r.verdict === "wrong" || r.verdict === "declined_wrongly"),
  ].filter((r) => r !== undefined);

  return (
    <div className="home">
      <SiteNav />

      <main>
        <section className="hero">
          <h1>Every answer comes with the page it came from.</h1>
          <p className="hero-lede">
            Askwell is a support assistant for your website. It answers visitors from your own documents, shows
            the passage it used, and says so when it doesn&rsquo;t know.
          </p>
        </section>

        <section className="stage" aria-labelledby="stage-title">
          <p className="stage-note" id="stage-title">
            This is the real assistant, running on the help pages of a made-up night train company. Ask it
            something and watch the document.
          </p>
          <Desk
            {...props}
            documents={documents.map((d) => ({ id: d.id, title: d.title, content: d.content }))}
          />
          <p className="stage-links">
            <Link href="/demo">See it as a chat box on the company&rsquo;s site</Link>
            <Link href="/dashboard">Open the owner area</Link>
          </p>
        </section>

        <section className="how" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How one answer is made</h2>
          <p className="section-lede">
            The four steps below are not a diagram. They are what happened, just now, when this page asked the
            demo &ldquo;{WORKED_QUESTION}&rdquo;
          </p>

          <ol className="steps">
            <li>
              <div>
                <h3>Documents are cut into passages</h3>
                <p>
                  {stats.documents} help pages became {stats.passages} passages. Each one keeps its heading, so a
                  passage about pets is found even when its text never says &ldquo;pets&rdquo;.
                </p>
              </div>
              <ul className="ev ev-docs" aria-label="Documents">
                {documents.map((d) => (
                  <li key={d.id}>
                    <span>{d.title}</span>
                    <span>{d.passageCount} passages</span>
                  </li>
                ))}
              </ul>
            </li>

            <li>
              <div>
                <h3>The question finds its passages</h3>
                <p>
                  Search ranks every passage against the question. With a database connected it matches by
                  meaning as well as by words, so &ldquo;puppy&rdquo; can find &ldquo;dog&rdquo;.
                </p>
              </div>
              <ol className="ev ev-found" aria-label="Best matching passages">
                {found.map((p) => (
                  <li key={p.id}>
                    <span className="ev-bar" style={{ "--w": `${Math.round((p.score / topScore) * 100)}%` } as React.CSSProperties} />
                    <strong>
                      {p.documentTitle} / {p.heading}
                    </strong>
                    <q>{excerpt(p.content, 96)}</q>
                  </li>
                ))}
              </ol>
            </li>

            <li>
              <div>
                <h3>The model gets the passages and strict rules</h3>
                <p>
                  The passages go to the AI model with instructions it cannot talk its way around. These three
                  lines are copied from the prompt this site sends.
                </p>
              </div>
              <ul className="ev ev-rules" aria-label="Rules from the prompt">
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </li>

            <li>
              <div>
                <h3>The answer names its source</h3>
                <p>
                  The visitor reads the answer and can open the passage behind it. Thumbs up or down goes back
                  to the owner.
                </p>
              </div>
              <div className="ev ev-answer">
                <p className="ev-q">{WORKED_QUESTION}</p>
                <blockquote>{worked.answer.split("\n\n").slice(1).join(" ").replace(/\s*\[\d+\]/g, "")}</blockquote>
                <p className="ev-src">
                  <span>1</span>
                  {worked.sources[0]?.documentTitle} / {worked.sources[0]?.heading}
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="decline" aria-labelledby="decline-title">
          <div className="decline-copy">
            <h2 id="decline-title">It would rather say &ldquo;I don&rsquo;t know&rdquo; than guess</h2>
            <p>
              A wrong answer about a refund costs more than no answer. When the documents don&rsquo;t cover a
              question, Askwell declines, takes the visitor&rsquo;s email, and puts the question in front of the
              owner as a gap to fill.
            </p>
            <p>
              The demo has declined {stats.unanswered} of {stats.questions} questions so far. Each one is listed
              in the <Link href="/dashboard">owner area</Link>.
            </p>
          </div>
          <figure className="decline-case">
            <p className="ev-q">{DECLINED_QUESTION}</p>
            <dl>
              <div>
                <dt>Closest passage</dt>
                <dd>
                  {nearMiss[0] ? `${nearMiss[0].documentTitle} / ${nearMiss[0].heading}` : "None"}
                </dd>
              </div>
              <div>
                <dt>How much of the question it covers</dt>
                <dd>
                  <b>{Math.round((nearMiss[0]?.coverage ?? 0) * 100)}%</b>, and 55% is the least Askwell will
                  answer from
                </dd>
              </div>
              <div>
                <dt>What the visitor is told</dt>
                <dd>I couldn&rsquo;t find that in the documents, so I won&rsquo;t guess.</dd>
              </div>
            </dl>
            <figcaption>
              The payments page mentions paying and tickets, but not the one word the question turns on.
            </figcaption>
          </figure>
        </section>

        <section className="quality" id="quality" aria-labelledby="quality-title">
          <div className="quality-head">
            <h2 id="quality-title">Marked like homework, every time the documents change</h2>
            <p className="section-lede">
              The owner keeps a list of questions with the facts a right answer must contain. One button runs all
              of them and grades the results, so a document edit that breaks an answer is caught before a
              customer finds it.
            </p>
          </div>

          <div className="scorecard">
            <p className="score-big">
              <b>{score.correct + score.declinedCorrectly}</b>
              <span>
                of {score.total} test questions passed
                <br />
                on this page load, in search-only mode
              </span>
            </p>
            <dl className="score-split">
              <div>
                <dt>Answered correctly</dt>
                <dd>{score.correct}</dd>
              </div>
              <div>
                <dt>Declined correctly</dt>
                <dd>{score.declinedCorrectly}</dd>
              </div>
              <div>
                <dt>Wrong or incomplete</dt>
                <dd>{score.wrong}</dd>
              </div>
              <div>
                <dt>Claims the sources don&rsquo;t back</dt>
                <dd>{score.ungrounded}</dd>
              </div>
            </dl>
          </div>

          <table className="score-rows">
            <caption className="sr-only">Three of the test questions and how they were graded</caption>
            <thead>
              <tr>
                <th scope="col">Test question</th>
                <th scope="col">Result</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((r) => (
                <tr key={r.testCaseId} data-pass={r.verdict === "correct" || r.verdict === "declined_correctly"}>
                  <th scope="row">{r.question}</th>
                  <td>
                    <span className="verdict">{VERDICT_LABEL[r.verdict]}</span>
                  </td>
                  <td>
                    {r.verdict === "correct" && "Every key fact is in the answer, and every number is in the source."}
                    {r.verdict === "declined_correctly" && "The documents don’t cover it, and the assistant said so."}
                    {r.verdict === "wrong" && `The answer left out: ${r.missingFacts.map((f) => f.split("|")[0]).join(", ")}.`}
                    {r.verdict === "declined_wrongly" && "The answer is in the documents, but search did not find it."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="quality-more">
            <Link className="button" href="/dashboard/quality">
              Run the tests yourself
            </Link>
            <span>
              Search-only mode quotes one passage, so it misses answers that need two. A model does better, and
              this page is how you would know.
            </span>
          </p>
        </section>

        <section className="keys" id="keys" aria-labelledby="keys-title">
          <h2 id="keys-title">No AI bill until you want one</h2>
          <div className="keys-grid">
            <div>
              <h3>Search-only mode</h3>
              <p>
                Out of the box, Askwell finds the best passage and quotes it word for word. It costs nothing to
                run and cannot invent anything. This is what the demo uses.
              </p>
            </div>
            <div>
              <h3>Model mode</h3>
              <p>
                Add an AI key and a model writes each answer from the passages, in your tone. You bring the key,
                so you choose the provider and pay them directly.
              </p>
              <ul className="providers" aria-label="Supported providers">
                {Object.values(PROVIDERS).map((p) => (
                  <li key={p.label}>{p.label.replace(/ \(.+\)/, "")}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Where a key goes</h3>
              <p>
                A key you paste on this site stays in your browser tab, travels only with your own questions,
                and is never written to the database or the logs. Close the tab and it is gone.
              </p>
            </div>
          </div>
        </section>

        <section className="built" aria-labelledby="built-title">
          <h2 id="built-title">What it&rsquo;s made of</h2>
          <dl>
            <div>
              <dt>Next.js and TypeScript</dt>
              <dd>The site, the owner area and the server routes are one project. Answers stream to the browser as they are written.</dd>
            </div>
            <div>
              <dt>Postgres on Supabase</dt>
              <dd>Every row belongs to one business, and row-level security in the database enforces it, not application code.</dd>
            </div>
            <div>
              <dt>Hybrid search</dt>
              <dd>Keyword ranking plus pgvector embeddings from a free model, merged and re-ranked for each question.</dd>
            </div>
            <div>
              <dt>Made with Claude</dt>
              <dd>Built in collaboration with Claude, Anthropic&rsquo;s AI model. Beki set the brief, directed the work and tested it; Claude wrote the code.</dd>
            </div>
            <div>
              <dt>Tested</dt>
              <dd>Unit tests cover the ranking, grading and citation logic. Playwright drives the chat and the owner area in a real browser.</dd>
            </div>
          </dl>
          <p>
            <a className="button button-quiet" href={REPO}>
              Read the source on GitHub
            </a>
          </p>
        </section>
      </main>

      <footer className="foot">
        <p>
          Askwell is a portfolio project by Beki, made in collaboration with Claude. Larkspur Night Line is invented for the
          demo.
        </p>
        <nav aria-label="Footer">
          <Link href="/demo">Demo site</Link>
          <Link href="/dashboard">Owner area</Link>
          <a href={REPO}>GitHub</a>
        </nav>
      </footer>
    </div>
  );
}
