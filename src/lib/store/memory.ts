import { answerQuestion } from "../answer";
import { chunkDocument } from "../chunk";
import {
  DEMO_BUSINESS,
  DEMO_DOCUMENTS,
  DEMO_FOLLOW_UPS,
  DEMO_SEED_QUESTIONS,
  DEMO_TEST_CASES,
} from "../demo-data";
import { summarise } from "../evals";
import { rankPassages } from "../rank";
import { runTest } from "../run-test";
import {
  type Business,
  type Conversation,
  type DocumentRecord,
  type EvalRun,
  type FollowUp,
  type Message,
  type Passage,
  StoreError,
  type TestCase,
} from "../types";
import { type Store, maskEmail } from "./types";

interface State {
  business: Business;
  documents: DocumentRecord[];
  passages: Passage[];
  conversations: { id: string; businessId: string; startedAt: string }[];
  messages: Message[];
  followUps: FollowUp[];
  testCases: TestCase[];
  evalRuns: EvalRun[];
}

const MAX_CONVERSATIONS = 300;

/** A uuid-shaped id derived from a string. */
function stableId(seed: string): string {
  let hex = "";
  for (let round = 0; hex.length < 32; round++) {
    let h = 2166136261 ^ round;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * In-memory store, seeded with the demo business. It backs local development,
 * the automated tests, and any deployment that has no database configured.
 * Data lives as long as the server process does.
 */
export function createMemoryStore(now: () => Date = () => new Date()): Store & { ready: Promise<void> } {
  // While the demo is being seeded, ids are derived from a counter, so every
  // server instance starts with the same ids. A host that runs several copies
  // of the server (Vercel does) can then follow a link or grade a test that
  // another copy produced. After seeding, ids are random.
  let seeding = true;
  let seeded = 0;
  const id = () => (seeding ? stableId(`askwell-seed-${seeded++}`) : crypto.randomUUID());

  const state: State = {
    business: { ...DEMO_BUSINESS },
    documents: [],
    passages: [],
    conversations: [],
    messages: [],
    followUps: [],
    testCases: DEMO_TEST_CASES.map((t) => ({ ...t, id: stableId(`test:${t.question}`), businessId: DEMO_BUSINESS.id })),
    evalRuns: [],
  };

  const ago = (minutes: number) => new Date(now().getTime() - minutes * 60_000).toISOString();

  const insertDocument = (
    doc: { title: string; content: string; sourceType?: DocumentRecord["sourceType"]; sourceUrl?: string | null },
    createdAt: string,
    stable = false,
  ): DocumentRecord => {
    const chunks = chunkDocument(doc.content);
    const record: DocumentRecord = {
      // Seeded documents get the same id on every server instance, so links to them keep working.
      id: stable ? stableId(doc.title) : id(),
      businessId: state.business.id,
      title: doc.title,
      sourceType: doc.sourceType ?? "text",
      sourceUrl: doc.sourceUrl ?? null,
      content: doc.content,
      passageCount: chunks.length,
      createdAt,
    };
    state.documents.push(record);
    for (const c of chunks) {
      state.passages.push({
        id: id(),
        documentId: record.id,
        documentTitle: record.title,
        heading: c.heading,
        position: c.position,
        content: c.content,
      });
    }
    return record;
  };

  const own = (businessId: string) => {
    if (businessId !== state.business.id) throw new StoreError("Business not found.", 404);
  };

  const store: Store = {
    kind: "memory",

    async getBusiness(slug) {
      return slug === state.business.slug ? { ...state.business } : null;
    },

    async updateBusiness(businessId, patch) {
      own(businessId);
      Object.assign(state.business, patch);
      return { ...state.business };
    },

    async listDocuments(businessId) {
      own(businessId);
      return [...state.documents].sort((a, b) => a.title.localeCompare(b.title));
    },

    async getDocument(businessId, docId) {
      own(businessId);
      return state.documents.find((d) => d.id === docId) ?? null;
    },

    async addDocument(businessId, doc) {
      own(businessId);
      return insertDocument(doc, now().toISOString());
    },

    async deleteDocument(businessId, docId) {
      own(businessId);
      state.documents = state.documents.filter((d) => d.id !== docId);
      state.passages = state.passages.filter((p) => p.documentId !== docId);
    },

    async search(business, query, k = 4) {
      own(business.id);
      return rankPassages(query, state.passages, k);
    },

    async questionsToday(businessId) {
      own(businessId);
      const day = now().toISOString().slice(0, 10);
      return state.messages.filter((m) => m.role === "visitor" && m.createdAt.startsWith(day)).length;
    },

    async logExchange(business, input) {
      own(business.id);
      const at = now().toISOString();
      let conversationId = input.conversationId;
      if (!conversationId || !state.conversations.some((c) => c.id === conversationId)) {
        conversationId = id();
        state.conversations.push({ id: conversationId, businessId: business.id, startedAt: at });
        if (state.conversations.length > MAX_CONVERSATIONS) {
          const dropped = state.conversations.shift()!;
          state.messages = state.messages.filter((m) => m.conversationId !== dropped.id);
        }
      }
      const base = { conversationId, feedback: null, createdAt: at };
      state.messages.push({
        ...base,
        id: id(),
        role: "visitor",
        content: input.question,
        sources: [],
        answered: null,
        mode: null,
      });
      const messageId = id();
      state.messages.push({
        ...base,
        id: messageId,
        role: "assistant",
        content: input.answer,
        sources: input.sources,
        answered: input.answered,
        mode: input.mode,
      });
      return { conversationId, messageId };
    },

    async setFeedback(messageId, value) {
      const message = state.messages.find((m) => m.id === messageId && m.role === "assistant");
      // A message another server instance wrote is not in this one's memory.
      // There is nothing to update, and that is not the visitor's mistake.
      if (message) message.feedback = value;
    },

    async addFollowUp(business, input) {
      own(business.id);
      state.followUps.push({
        id: id(),
        businessId: business.id,
        conversationId: input.conversationId,
        // The demo's owner area is public, so real addresses are never kept in it.
        email: business.isDemo ? maskEmail(input.email) : input.email,
        question: input.question,
        status: "open",
        createdAt: now().toISOString(),
      });
    },

    async listConversations(businessId) {
      own(businessId);
      return state.conversations
        .map((c): Conversation => {
          const messages = state.messages.filter((m) => m.conversationId === c.id);
          return {
            id: c.id,
            businessId: c.businessId,
            startedAt: c.startedAt,
            lastMessageAt: messages.at(-1)?.createdAt ?? c.startedAt,
            messageCount: messages.length,
            unanswered: messages.filter((m) => m.answered === false).length,
            preview: messages.find((m) => m.role === "visitor")?.content ?? "",
          };
        })
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    },

    async getMessages(businessId, conversationId) {
      own(businessId);
      return state.messages.filter((m) => m.conversationId === conversationId);
    },

    async listUnanswered(businessId) {
      own(businessId);
      return state.messages
        .map((m, i) => ({ m, question: state.messages[i - 1] }))
        .filter(({ m }) => m.role === "assistant" && m.answered === false)
        .map(({ m, question }) => ({
          messageId: m.id,
          conversationId: m.conversationId,
          question: question?.content ?? "",
          createdAt: m.createdAt,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listFollowUps(businessId) {
      own(businessId);
      return [...state.followUps].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async setFollowUpStatus(businessId, followUpId, status) {
      own(businessId);
      const item = state.followUps.find((f) => f.id === followUpId);
      if (!item) throw new StoreError("Follow-up not found.", 404);
      item.status = status;
    },

    async listTestCases(businessId) {
      own(businessId);
      return [...state.testCases];
    },

    async addTestCase(businessId, test) {
      own(businessId);
      const record = { ...test, id: id(), businessId };
      state.testCases.push(record);
      return record;
    },

    async deleteTestCase(businessId, testId) {
      own(businessId);
      state.testCases = state.testCases.filter((t) => t.id !== testId);
    },

    async saveEvalRun(run) {
      own(run.businessId);
      const record: EvalRun = { ...run, id: id(), createdAt: now().toISOString() };
      state.evalRuns.unshift(record);
      state.evalRuns.length = Math.min(state.evalRuns.length, 20);
      return record;
    },

    async listEvalRuns(businessId) {
      own(businessId);
      return [...state.evalRuns];
    },

    async stats(businessId) {
      own(businessId);
      const answers = state.messages.filter((m) => m.role === "assistant");
      return {
        conversations: state.conversations.length,
        questions: answers.length,
        answered: answers.filter((m) => m.answered).length,
        unanswered: answers.filter((m) => m.answered === false).length,
        helpful: answers.filter((m) => m.feedback === 1).length,
        notHelpful: answers.filter((m) => m.feedback === -1).length,
        openFollowUps: state.followUps.filter((f) => f.status === "open").length,
        documents: state.documents.length,
        passages: state.passages.length,
        questionsToday: await store.questionsToday(businessId),
      };
    },
  };

  /**
   * The starting conversations are not written by hand: each seed question is
   * run through the same answer pipeline a visitor's question goes through.
   */
  const seed = async () => {
    for (const doc of DEMO_DOCUMENTS) insertDocument(doc, ago(60 * 24 * 9), true);
    for (const convo of DEMO_SEED_QUESTIONS) {
      let conversationId: string | null = null;
      for (const [i, question] of convo.questions.entries()) {
        const passages = await store.search(state.business, question);
        let done: { answer: string; answered: boolean; sources: Message["sources"] } | null = null;
        for await (const event of answerQuestion({
          business: state.business,
          question,
          history: [],
          passages,
          llm: null,
        })) {
          if (event.type === "done") done = event;
        }
        if (!done) continue;
        const logged = await store.logExchange(state.business, {
          conversationId,
          question,
          answer: done.answer,
          sources: done.sources,
          answered: done.answered,
          mode: "search",
        });
        conversationId = logged.conversationId;
        const at = ago(convo.minutesAgo - i);
        for (const m of state.messages.filter((m) => m.conversationId === conversationId).slice(-2)) {
          m.createdAt = at;
        }
        state.conversations.find((c) => c.id === conversationId)!.startedAt = ago(convo.minutesAgo);
        const feedback = convo.feedback?.[i];
        if (feedback) await store.setFeedback(logged.messageId, feedback);
      }
    }
    for (const f of DEMO_FOLLOW_UPS) {
      state.followUps.push({
        id: id(),
        businessId: state.business.id,
        conversationId: null,
        email: f.email,
        question: f.question,
        status: "open",
        createdAt: ago(f.minutesAgo),
      });
    }

    // One test run, so the owner area opens with a real score. It is produced
    // by the same code the "Run all tests" button calls.
    const results = [];
    for (const test of state.testCases) results.push(await runTest(store, state.business, test, null));
    state.evalRuns.push({
      id: id(),
      businessId: state.business.id,
      createdAt: ago(60 * 26),
      mode: "search",
      model: null,
      ...summarise(results),
      results,
    });
    seeding = false;
  };

  return Object.assign(store, { ready: seed() });
}
