import { describe, expect, it } from "vitest";
import { answerQuestion, quoteAnswer, renumberCitations, smallTalk, type AnswerEvent } from "@/lib/answer";
import { chunkDocument } from "@/lib/chunk";
import { DEMO_BUSINESS } from "@/lib/demo-data";
import { grade, missingFacts, summarise, unsupportedClaims } from "@/lib/evals";
import { htmlToText, isPrivateAddress } from "@/lib/ingest-text";
import { isConfident, rankPassages } from "@/lib/rank";
import { runTest } from "@/lib/run-test";
import { createMemoryStore } from "@/lib/store/memory";
import { figures, stem, tokens } from "@/lib/text";
import type { Passage, Source, TestCase } from "@/lib/types";

const passage = (id: string, heading: string, content: string): Passage => ({
  id,
  documentId: "d",
  documentTitle: "Help",
  heading,
  position: 0,
  content,
});

async function collect(stream: AsyncGenerator<AnswerEvent>) {
  let done: Extract<AnswerEvent, { type: "done" }> | undefined;
  let text = "";
  for await (const event of stream) {
    if (event.type === "delta") text += event.text;
    if (event.type === "done") done = event;
  }
  return { done: done!, text };
}

describe("text", () => {
  it("stems related word forms to the same token", () => {
    expect(stem("refunds")).toBe(stem("refund"));
    expect(stem("closing")).toBe(stem("closes"));
    expect(stem("cancelled")).toBe(stem("cancel"));
    expect(stem("arrived")).toBe(stem("arrive"));
  });

  it("drops question words and keeps content words", () => {
    expect(tokens("What's the luggage allowance?")).toEqual(["luggag", "allowanc"]);
  });

  it("finds prices, times and percentages", () => {
    expect(figures("Pay €30 by 20:15, or 50% after 1,000 days.")).toEqual(["30", "20:15", "50%", "1000"]);
  });
});

describe("chunkDocument", () => {
  it("starts a passage at each heading and keeps the heading with it", () => {
    const chunks = chunkDocument("# Pets\nDogs are welcome.\n\n## Bikes\nBikes cost €12.");
    expect(chunks.map((c) => c.heading)).toEqual(["Pets", "Bikes"]);
    expect(chunks[1].content).toBe("Bikes cost €12.");
  });

  it("splits long sections without cutting a sentence", () => {
    const sentence = "This sentence is exactly long enough to matter for the test. ";
    const chunks = chunkDocument(`# Long\n${sentence.repeat(40)}`);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(900);
      expect(c.content.endsWith(".")).toBe(true);
    }
  });

  it("returns nothing for an empty document", () => {
    expect(chunkDocument("  \n ")).toEqual([]);
  });
});

describe("rankPassages", () => {
  const passages = [
    passage("pets", "Dogs and cats", "Dogs and cats are welcome in sleeper cabins. A pet ticket costs €30."),
    passage("bikes", "Bikes", "A bike reservation costs €12 and must be booked in advance."),
    passage("pay", "Paying", "We accept Visa and Mastercard for every ticket."),
  ];

  it("puts the passage about the subject first", () => {
    expect(rankPassages("Can I bring my dog?", passages)[0].id).toBe("pets");
    expect(rankPassages("how much for a bike", passages)[0].id).toBe("bikes");
  });

  it("finds a passage by its heading alone", () => {
    const found = rankPassages("paying", [passage("x", "Paying", "Cards only."), passages[1]]);
    expect(found[0].id).toBe("x");
  });

  it("is not confident when the key word of the question is nowhere in the documents", () => {
    const found = rankPassages("Can I pay for my ticket with Bitcoin?", passages);
    expect(found[0].id).toBe("pay");
    expect(isConfident(found)).toBe(false);
  });

  it("is confident on a direct match and not on no match", () => {
    expect(isConfident(rankPassages("pet ticket cost", passages))).toBe(true);
    expect(isConfident(rankPassages("zebra", passages))).toBe(false);
  });

  it("lets a strong meaning match stand in for shared words", () => {
    const found = rankPassages("puppy", [{ ...passages[0], similarity: 0.9 }, { ...passages[1], similarity: 0.76 }]);
    expect(found[0].id).toBe("pets");
    expect(isConfident(found)).toBe(true);
  });
});

describe("answers", () => {
  const sources: Source[] = [1, 2, 3].map((n) => ({
    n,
    passageId: `p${n}`,
    documentId: "d",
    documentTitle: `Doc ${n}`,
    heading: null,
    excerpt: "",
  }));

  it("keeps only cited sources and renumbers them from 1", () => {
    const out = renumberCitations("Yes [3]. Also this [1], and again [3].", sources);
    expect(out.text).toBe("Yes [1]. Also this [2], and again [1].");
    expect(out.sources.map((s) => s.documentTitle)).toEqual(["Doc 3", "Doc 1"]);
  });

  it("drops citation numbers that match no source", () => {
    expect(renumberCitations("Sure [7] thing [2].", sources).text).toBe("Sure thing [1].");
  });

  it("falls back to the first source when the model cites nothing", () => {
    expect(renumberCitations("Yes.", sources).sources).toHaveLength(1);
  });

  it("quotes the paragraph that fits the question", () => {
    const ranked = rankPassages("dog ticket", [
      passage("p", "Pets", "Cats nap anywhere.\n\nA dog ticket costs €30 per animal."),
    ]);
    const { text } = quoteAnswer("dog ticket", ranked);
    expect(text).toContain("€30");
    expect(text).toMatch(/^From Help, under “Pets”:/);
  });

  it("answers greetings without searching", () => {
    expect(smallTalk(DEMO_BUSINESS, "Hello!")).toContain("Larkspur");
    expect(smallTalk(DEMO_BUSINESS, "hello, can I bring a dog")).toBeNull();
  });

  it("declines, with no sources, when nothing matches", async () => {
    const { done, text } = await collect(
      answerQuestion({ business: DEMO_BUSINESS, question: "zebra crossing?", history: [], passages: [], llm: null }),
    );
    expect(done.answered).toBe(false);
    expect(done.sources).toEqual([]);
    expect(text).toBe(done.answer);
  });
});

describe("grading", () => {
  const test: TestCase = {
    id: "t",
    businessId: "b",
    question: "Pets?",
    expected: "",
    keyFacts: ["€30|30 euro", "whole cabin"],
    shouldAnswer: true,
  };

  it("accepts either wording of a fact and ignores case", () => {
    expect(missingFacts("It is 30 EURO if you book the Whole Cabin.", test.keyFacts)).toEqual([]);
    expect(missingFacts("It is €30.", test.keyFacts)).toEqual(["whole cabin"]);
  });

  it("flags a number that is not in the sources", () => {
    const evidence = "A pet ticket costs €30 per animal, with a limit of two animals per cabin.";
    expect(unsupportedClaims("A pet ticket costs €30 per animal [1].", evidence)).toEqual([]);
    expect(unsupportedClaims("A pet ticket costs €45 per animal [1].", evidence)).toHaveLength(1);
  });

  it("flags a sentence the sources do not back", () => {
    const evidence = "Dogs are welcome in sleeper cabins.";
    const flagged = unsupportedClaims("Dogs are welcome in sleeper cabins. We also serve free champagne to every puppy.", evidence);
    expect(flagged).toEqual(["We also serve free champagne to every puppy."]);
  });

  it("gives each outcome the right verdict", () => {
    const evidence = "€30 whole cabin";
    const decline = { ...test, shouldAnswer: false, keyFacts: [] };
    expect(grade(test, { answer: "€30, whole cabin", answered: true, evidence }).verdict).toBe("correct");
    expect(grade(test, { answer: "€30", answered: true, evidence }).verdict).toBe("wrong");
    expect(grade(test, { answer: "", answered: false, evidence }).verdict).toBe("declined_wrongly");
    expect(grade(decline, { answer: "", answered: false, evidence }).verdict).toBe("declined_correctly");
    expect(grade(decline, { answer: "Sure", answered: true, evidence }).verdict).toBe("answered_wrongly");
  });
});

describe("importing web pages", () => {
  it("keeps headings and text, drops scripts and navigation", () => {
    const text = htmlToText(
      "<body><nav>Menu</nav><main><h2>Returns &amp; refunds</h2><p>Within <b>30</b> days.</p><script>x()</script><ul><li>One</li><li>Two</li></ul></main></body>",
    );
    expect(text).toBe("# Returns & refunds\n\nWithin 30 days.\n\n- One\n- Two");
  });

  it("recognises private network addresses", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "192.168.0.9", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(a), a).toBe(true);
    }
    for (const a of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(a), a).toBe(false);
  });
});

describe("the demo knowledge base", () => {
  it("passes its own test set in search-only mode, apart from the known two-passage question", async () => {
    const store = createMemoryStore();
    await store.ready;
    const tests = await store.listTestCases(DEMO_BUSINESS.id);
    const results = await Promise.all(tests.map((t) => runTest(store, DEMO_BUSINESS, t, null)));
    const failed = results.filter((r) => r.verdict !== "correct" && r.verdict !== "declined_correctly");
    expect(failed.map((r) => r.question)).toEqual(["Can I get a refund on a Saver ticket?"]);
    expect(summarise(results).ungrounded).toBe(0);
  });

  it("answers the questions offered as buttons in the chat box", async () => {
    const store = createMemoryStore();
    await store.ready;
    for (const question of DEMO_BUSINESS.suggestions) {
      const passages = await store.search(DEMO_BUSINESS, question);
      expect(isConfident(passages), question).toBe(true);
    }
  });

  it("seeds conversations, masks follow-up emails and counts stats", async () => {
    const store = createMemoryStore();
    await store.ready;
    const stats = await store.stats(DEMO_BUSINESS.id);
    expect(stats.documents).toBe(8);
    expect(stats.conversations).toBeGreaterThan(5);
    expect(stats.unanswered).toBeGreaterThan(0);

    await store.addFollowUp(DEMO_BUSINESS, { conversationId: null, email: "dana@example.com", question: "?" });
    expect((await store.listFollowUps(DEMO_BUSINESS.id))[0].email).toBe("d•••@example.com");
  });

  it("stops finding a document once it is deleted", async () => {
    const store = createMemoryStore();
    await store.ready;
    const doc = (await store.listDocuments(DEMO_BUSINESS.id)).find((d) => d.title.startsWith("Luggage"))!;
    await store.deleteDocument(DEMO_BUSINESS.id, doc.id);
    const found = await store.search(DEMO_BUSINESS, "Can I bring my dog on the train?");
    expect(found.every((p) => p.documentId !== doc.id)).toBe(true);
  });
});
