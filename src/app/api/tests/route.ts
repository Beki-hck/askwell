import { json, readJson, route, text } from "@/lib/http";
import { getOwner } from "@/lib/session";
import { StoreError } from "@/lib/types";

export const POST = route(async (request: Request) => {
  const { store, business } = await getOwner();
  const body = await readJson(request);
  const shouldAnswer = body.shouldAnswer !== false;
  const keyFacts = Array.isArray(body.keyFacts)
    ? body.keyFacts
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (shouldAnswer && !keyFacts.length) {
    throw new StoreError("Add at least one key fact the answer must contain.", 400);
  }
  if ((await store.listTestCases(business.id)).length >= 100) {
    throw new StoreError("A test set holds up to 100 questions.", 409);
  }
  const test = await store.addTestCase(business.id, {
    question: text(body.question, "Question", 500),
    expected: typeof body.expected === "string" ? body.expected.trim().slice(0, 1000) : "",
    keyFacts: shouldAnswer ? keyFacts : [],
    shouldAnswer,
  });
  return json({ test }, 201);
});
