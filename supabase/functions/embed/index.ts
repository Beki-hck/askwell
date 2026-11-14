// Askwell embedding function.
//
// Turns text into 384-number vectors with gte-small, a small model that
// Supabase runs for free inside edge functions. Two uses:
//   { "input": "a question" }      -> { "embedding": [...] }
//   { "backfill": "<business id>" } -> embeds that business's passages that have none yet
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
const session = new (globalThis as any).Supabase.ai.Session("gte-small");
const embed = (text: string): Promise<number[]> =>
  session.run(text.slice(0, 2000), { mean_pool: true, normalize: true });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  let body: { input?: unknown; backfill?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  if (typeof body.input === "string" && body.input.trim()) {
    return json({ embedding: await embed(body.input) });
  }

  if (typeof body.backfill === "string") {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows, error } = await admin
      .from("passages")
      .select("id, document_title, heading, content")
      .eq("business_id", body.backfill)
      .is("embedding", null)
      .limit(60);
    if (error) return json({ error: error.message }, 500);

    let done = 0;
    for (const row of rows ?? []) {
      // The heading travels with the text so "Pets" still matters to a passage that never says it.
      const vector = await embed(`${row.document_title}. ${row.heading ?? ""}\n${row.content}`);
      const { error: failed } = await admin
        .from("passages")
        .update({ embedding: JSON.stringify(vector) })
        .eq("id", row.id);
      if (!failed) done++;
    }
    return json({ embedded: done, remaining: (rows?.length ?? 0) - done });
  }

  return json({ error: "Send { input } or { backfill }." }, 400);
});
