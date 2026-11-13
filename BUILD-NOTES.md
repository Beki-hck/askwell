# Build notes (working file, delete before final)

Stack: Next 16 (app router, src/), no Tailwind, self-hosted fonts via @fontsource-variable.
Supabase project ref: jkudmnithsymlrmpwnrf (container cannot reach supabase.co; use MCP only).
No Ollama in container. No-key "search" mode quotes passages; BYO key for model mode.
Demo business: Larkspur Night Line (slug larkspur), assistant "Wren".
Design: Askwell = paper #F5F6F8, ink #15171E, ultramarine #2A3CE6, highlighter #FFE14D.
Fonts: Funnel Display (headlines), Funnel Sans (UI), Newsreader (anything quoted from documents).

## Done
- src/lib: types, text, chunk, rank, llm, answer, evals, demo-data, store/memory

## To do (in order)
- store/index + supabase store, session/auth
- API routes: chat, feedback, followup, documents, settings, tests, evals/run
- Widget component, /demo (Larkspur page), /embed/[slug], public/widget.js
- Landing page, dashboard pages, login
- Supabase migration + edge function embed + seed
- unit tests, Playwright tests, README, Vercel steps, push
