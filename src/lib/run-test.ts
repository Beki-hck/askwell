import { answerQuestion } from "./answer";
import { grade } from "./evals";
import type { LlmConfig } from "./llm";
import type { Store } from "./store/types";
import type { Business, TestCase, TestResult } from "./types";

/** Runs one test question through the same pipeline a visitor's question takes, and grades it. */
export async function runTest(
  store: Store,
  business: Business,
  test: TestCase,
  llm: LlmConfig | null,
  signal?: AbortSignal,
): Promise<TestResult> {
  const passages = await store.search(business, test.question, 4);
  let answer = "";
  let answered = false;
  let sources: TestResult["sources"] = [];
  for await (const event of answerQuestion({ business, question: test.question, history: [], passages, llm, signal })) {
    if (event.type === "done") ({ answer, answered, sources } = event);
  }
  return {
    testCaseId: test.id,
    question: test.question,
    expected: test.expected,
    answer,
    answered,
    sources,
    ...grade(test, { answer, answered, evidence: passages.map((p) => p.content).join("\n") }),
  };
}
