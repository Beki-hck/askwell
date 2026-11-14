/**
 * Prints SQL that stores one search-only test run for the demo business, so
 * the hosted owner area opens with a real score. The run is produced by the
 * same code the "Run all tests" button calls; only the test ids are mapped to
 * the ones in the database. Usage: npx tsx scripts/demo-run-sql.ts ids.json
 * where ids.json is [{ id, q }] from `select id, question as q from test_cases`.
 */
import { readFileSync } from "node:fs";
import { DEMO_BUSINESS } from "../src/lib/demo-data";
import { summarise } from "../src/lib/evals";
import { runTest } from "../src/lib/run-test";
import { createMemoryStore } from "../src/lib/store/memory";

const QUOTE = "$" + "run" + "$";

async function main() {
  const ids = JSON.parse(readFileSync(process.argv[2], "utf8")) as { id: string; q: string }[];
  const store = createMemoryStore();
  await store.ready;
  const results = [];
  for (const test of await store.listTestCases(DEMO_BUSINESS.id)) {
    const dbId = ids.find((t) => t.q === test.question)?.id;
    if (!dbId) throw new Error(`No database test for: ${test.question}`);
    const result = await runTest(store, DEMO_BUSINESS, test, null);
    results.push({ ...result, testCaseId: dbId });
  }
  const s = summarise(results);
  const json = JSON.stringify(results);
  if (json.includes(QUOTE)) throw new Error("Quote marker found in results.");
  console.log(
    "insert into public.eval_runs (business_id, mode, model, total, correct, wrong, declined_correctly, ungrounded, results, created_at)\n" +
      `values ('${DEMO_BUSINESS.id}', 'search', null, ${s.total}, ${s.correct}, ${s.wrong}, ${s.declinedCorrectly}, ${s.ungrounded}, ` +
      `${QUOTE}${json}${QUOTE}::jsonb, now() - interval '26 hours');`,
  );
}

void main();
