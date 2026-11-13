import { answerQuestion } from "@/lib/answer";
import { grade, summarise } from "@/lib/evals";
import { rateLimit, route } from "@/lib/http";
import { LlmError, llmFromHeaders, serverLlm } from "@/lib/llm";
import { getViewer } from "@/lib/session";
import { StoreError, type TestResult } from "@/lib/types";

export const maxDuration = 300;

/**
 * Runs every test question through the same pipeline a visitor's question
 * takes, grades each answer, and streams results as JSON lines so the page
 * can fill in as it goes.
 */
export const POST = route(async (request: Request) => {
  rateLimit(request, "evals", 6, 60_000);
  const { store, business, readOnly } = await getViewer();
  const tests = await store.listTestCases(business.id);
  if (!tests.length) throw new StoreError("Add a test question first.", 400);
  const llm = llmFromHeaders(request.headers) ?? serverLlm();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const results: TestResult[] = [];
      try {
        send({ type: "start", total: tests.length, mode: llm ? "model" : "search", model: llm?.model ?? null });
        for (const test of tests) {
          if (request.signal.aborted) return;
          const passages = await store.search(business, test.question, 4);
          let answer = "";
          let answered = false;
          let sources: TestResult["sources"] = [];
          for await (const event of answerQuestion({
            business,
            question: test.question,
            history: [],
            passages,
            llm,
            signal: request.signal,
          })) {
            if (event.type === "done") ({ answer, answered, sources } = event);
          }
          const result: TestResult = {
            testCaseId: test.id,
            question: test.question,
            expected: test.expected,
            answer,
            answered,
            sources,
            ...grade(test, { answer, answered, evidence: passages.map((p) => p.content).join("\n") }),
          };
          results.push(result);
          send({ type: "result", result });
        }
        const run = {
          businessId: business.id,
          mode: llm ? ("model" as const) : ("search" as const),
          model: llm?.model ?? null,
          ...summarise(results),
          results,
        };
        // The public demo shows the run but does not keep it.
        const saved = readOnly
          ? { ...run, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
          : await store.saveEvalRun(run);
        send({ type: "done", run: saved, saved: !readOnly });
      } catch (error) {
        if (!request.signal.aborted) {
          const known = error instanceof LlmError || error instanceof StoreError;
          if (!known) console.error(error);
          send({ type: "error", message: known ? error.message : "The run stopped unexpectedly." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
});
