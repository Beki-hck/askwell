import type { EvalRun, TestCase, TestResult, Verdict } from "./types";
import { figures, sentences, tokens } from "./text";

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/\s+/g, " ");

/** Key facts the answer left out. `a|b` passes when either wording appears. */
export function missingFacts(answer: string, keyFacts: string[]): string[] {
  const text = normalise(answer);
  return keyFacts.filter(
    (fact) => !fact.split("|").some((alt) => text.includes(normalise(alt.trim()))),
  );
}

/**
 * Checks that an answer is backed by the passages it was given.
 *
 * Two tests, both deterministic so the page costs nothing to run:
 * every number in the answer must appear in the evidence, and most of the
 * content words of every sentence must too. A sentence that fails is returned
 * so the owner can read exactly what the assistant added on its own.
 */
export function unsupportedClaims(answer: string, evidence: string): string[] {
  const body = answer.replace(/\[\d+\]/g, " ").replace(/^From .+?:\n/, "");
  const evidenceWords = new Set(tokens(evidence));
  const evidenceFigures = new Set(figures(evidence));
  const flagged: string[] = [];

  for (const sentence of body.split("\n").flatMap(sentences)) {
    const content = tokens(sentence);
    if (content.length < 3) continue;
    const badFigure = figures(sentence).some((f) => !evidenceFigures.has(f));
    const overlap = content.filter((w) => evidenceWords.has(w)).length / content.length;
    if (badFigure || overlap < 0.6) flagged.push(sentence.trim());
  }
  return flagged;
}

export function grade(
  test: TestCase,
  outcome: { answer: string; answered: boolean; evidence: string },
): Pick<TestResult, "verdict" | "missingFacts" | "grounded" | "unsupported"> {
  const missing = outcome.answered ? missingFacts(outcome.answer, test.keyFacts) : test.keyFacts;
  const unsupported = outcome.answered ? unsupportedClaims(outcome.answer, outcome.evidence) : [];

  let verdict: Verdict;
  if (test.shouldAnswer) {
    if (!outcome.answered) verdict = "declined_wrongly";
    else verdict = missing.length ? "wrong" : "correct";
  } else {
    verdict = outcome.answered ? "answered_wrongly" : "declined_correctly";
  }

  return {
    verdict,
    missingFacts: test.shouldAnswer ? missing : [],
    grounded: unsupported.length === 0,
    unsupported,
  };
}

export function summarise(
  results: TestResult[],
): Pick<EvalRun, "total" | "correct" | "wrong" | "declinedCorrectly" | "ungrounded"> {
  const count = (v: Verdict) => results.filter((r) => r.verdict === v).length;
  return {
    total: results.length,
    correct: count("correct"),
    declinedCorrectly: count("declined_correctly"),
    wrong: count("wrong") + count("declined_wrongly") + count("answered_wrongly"),
    ungrounded: results.filter((r) => !r.grounded).length,
  };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  correct: "Correct",
  wrong: "Missing facts",
  declined_correctly: "Declined, correctly",
  declined_wrongly: "Declined, but the answer is in the documents",
  answered_wrongly: "Answered, but should have declined",
};
