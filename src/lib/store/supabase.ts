import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkDocument } from "../chunk";
import { rankPassages } from "../rank";
import {
  type Business,
  type Conversation,
  type DocumentRecord,
  type EvalRun,
  type FollowUp,
  type Message,
  StoreError,
  type TestCase,
} from "../types";
import type { Store } from "./types";

/* Row shapes as Postgres returns them. */
interface BusinessRow {
  id: string;
  slug: string;
  name: string;
  assistant_name: string;
  greeting: string;
  tone: Business["tone"];
  daily_limit: number;
  is_demo: boolean;
  suggestions: string[];
}
interface DocumentRow {
  id: string;
  business_id: string;
  title: string;
  source_type: DocumentRecord["sourceType"];
  source_url: string | null;
  content: string;
  passage_count: number;
  created_at: string;
}
interface MessageRow {
  id: string;
  conversation_id: string;
  role: Message["role"];
  content: string;
  sources: Message["sources"];
  answered: boolean | null;
  mode: Message["mode"];
  feedback: 1 | -1 | null;
  created_at: string;
}

const BUSINESS_COLUMNS =
  "id, slug, name, assistant_name, greeting, tone, daily_limit, is_demo, suggestions";

export const toBusiness = (r: BusinessRow): Business => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  assistantName: r.assistant_name,
  greeting: r.greeting,
  tone: r.tone,
  dailyLimit: r.daily_limit,
  isDemo: r.is_demo,
  suggestions: r.suggestions ?? [],
});

const toDocument = (r: DocumentRow): DocumentRecord => ({
  id: r.id,
  businessId: r.business_id,
  title: r.title,
  sourceType: r.source_type,
  sourceUrl: r.source_url,
  content: r.content,
  passageCount: r.passage_count,
  createdAt: r.created_at,
});

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  role: r.role,
  content: r.content,
  sources: r.sources ?? [],
  answered: r.answered,
  mode: r.mode,
  feedback: r.feedback,
  createdAt: r.created_at,
});

function check<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    if (result.error.message.includes("daily limit")) {
      throw new StoreError("This assistant has reached its daily question limit.", 429);
    }
    if (result.error.code === "42501") throw new StoreError("You cannot change this business.", 403);
    throw new StoreError(result.error.message, 500);
  }
  return result.data;
}

/**
 * Postgres-backed store. Every query runs as the current visitor or owner, so
 * what it can see and change is decided by the row-level security policies in
 * supabase/migrations, not by this file.
 */
export function createSupabaseStore(db: SupabaseClient): Store {
  /** Turns a question into a vector with the free model hosted in an edge function. */
  const embed = async (text: string): Promise<number[] | null> => {
    try {
      const { data, error } = await db.functions.invoke("embed", {
        body: { input: text.slice(0, 1000) },
        signal: AbortSignal.timeout(4000),
      });
      if (error || !Array.isArray(data?.embedding)) return null;
      return data.embedding as number[];
    } catch {
      // Search still works on keywords alone when the embedding service is slow or down.
      return null;
    }
  };

  const store: Store = {
    kind: "supabase",

    async getBusiness(slug) {
      const row = check(
        await db.from("businesses").select(BUSINESS_COLUMNS).eq("slug", slug).maybeSingle(),
      );
      return row ? toBusiness(row as BusinessRow) : null;
    },

    async updateBusiness(businessId, patch) {
      const row = check(
        await db
          .from("businesses")
          .update({
            name: patch.name,
            assistant_name: patch.assistantName,
            greeting: patch.greeting,
            tone: patch.tone,
            daily_limit: patch.dailyLimit,
            suggestions: patch.suggestions,
          })
          .eq("id", businessId)
          .select(BUSINESS_COLUMNS)
          .maybeSingle(),
      );
      if (!row) throw new StoreError("You cannot change this business.", 403);
      return toBusiness(row as BusinessRow);
    },

    async listDocuments(businessId) {
      const rows = check(
        await db.from("documents").select("*").eq("business_id", businessId).order("title"),
      );
      return (rows as DocumentRow[]).map(toDocument);
    },

    async getDocument(businessId, id) {
      const row = check(
        await db.from("documents").select("*").eq("business_id", businessId).eq("id", id).maybeSingle(),
      );
      return row ? toDocument(row as DocumentRow) : null;
    },

    async addDocument(businessId, doc) {
      const chunks = chunkDocument(doc.content);
      const row = check(
        await db
          .from("documents")
          .insert({
            business_id: businessId,
            title: doc.title,
            source_type: doc.sourceType,
            source_url: doc.sourceUrl,
            content: doc.content,
            passage_count: chunks.length,
          })
          .select("*")
          .single(),
      ) as DocumentRow;

      const inserted = await db.from("passages").insert(
        chunks.map((c) => ({
          business_id: businessId,
          document_id: row.id,
          document_title: doc.title,
          heading: c.heading,
          position: c.position,
          content: c.content,
        })),
      );
      if (inserted.error) {
        // Do not leave a document behind that the assistant cannot search.
        await db.from("documents").delete().eq("id", row.id);
        throw new StoreError(inserted.error.message, 500);
      }

      // Embeddings are filled in by the edge function. If it fails, the
      // passages are still found by keyword and are picked up on the next run.
      await db.functions
        .invoke("embed", { body: { backfill: businessId }, signal: AbortSignal.timeout(20_000) })
        .catch(() => null);

      return toDocument(row);
    },

    async deleteDocument(businessId, id) {
      check(await db.from("documents").delete().eq("business_id", businessId).eq("id", id));
    },

    async search(business, query, k = 4) {
      const embedding = await embed(query);
      const rows = check(
        await db.rpc("match_passages", {
          p_business_id: business.id,
          p_query: query,
          p_embedding: embedding ? JSON.stringify(embedding) : null,
          p_limit: 12,
        }),
      ) as {
        id: string;
        document_id: string;
        document_title: string;
        heading: string | null;
        position: number;
        content: string;
        similarity: number | null;
      }[];

      return rankPassages(
        query,
        rows.map((r) => ({
          id: r.id,
          documentId: r.document_id,
          documentTitle: r.document_title,
          heading: r.heading,
          position: r.position,
          content: r.content,
          similarity: r.similarity,
        })),
        k,
      );
    },

    async questionsToday(businessId) {
      return check(await db.rpc("questions_today", { p_business_id: businessId })) as number;
    },

    async logExchange(business, input) {
      const rows = check(
        await db.rpc("log_exchange", {
          p_business_id: business.id,
          p_conversation_id: input.conversationId,
          p_question: input.question,
          p_answer: input.answer,
          p_sources: input.sources,
          p_answered: input.answered,
          p_mode: input.mode,
        }),
      ) as { conversation_id: string; message_id: string }[];
      return { conversationId: rows[0].conversation_id, messageId: rows[0].message_id };
    },

    async setFeedback(messageId, value) {
      check(await db.rpc("rate_message", { p_message_id: messageId, p_value: value }));
    },

    async addFollowUp(business, input) {
      check(
        await db.rpc("request_follow_up", {
          p_business_id: business.id,
          p_conversation_id: input.conversationId,
          p_email: input.email,
          p_question: input.question,
        }),
      );
    },

    async listConversations(businessId) {
      const rows = check(
        await db
          .from("messages")
          .select("id, conversation_id, role, content, answered, created_at")
          .eq("business_id", businessId)
          .order("seq", { ascending: false })
          .limit(1000),
      ) as Pick<MessageRow, "conversation_id" | "role" | "content" | "answered" | "created_at">[];

      const byConversation = new Map<string, Conversation>();
      // Rows arrive newest first, so later writes to startedAt/preview end on the oldest.
      for (const m of rows) {
        const c = byConversation.get(m.conversation_id) ?? {
          id: m.conversation_id,
          businessId,
          startedAt: m.created_at,
          lastMessageAt: m.created_at,
          messageCount: 0,
          unanswered: 0,
          preview: "",
        };
        c.messageCount++;
        c.startedAt = m.created_at;
        if (m.answered === false) c.unanswered++;
        if (m.role === "visitor") c.preview = m.content;
        byConversation.set(m.conversation_id, c);
      }
      return [...byConversation.values()];
    },

    async getMessages(businessId, conversationId) {
      const rows = check(
        await db
          .from("messages")
          .select("*")
          .eq("business_id", businessId)
          .eq("conversation_id", conversationId)
          .order("seq"),
      );
      return (rows as MessageRow[]).map(toMessage);
    },

    async listUnanswered(businessId) {
      const declined = check(
        await db
          .from("messages")
          .select("id, conversation_id, created_at")
          .eq("business_id", businessId)
          .eq("answered", false)
          .order("seq", { ascending: false })
          .limit(100),
      ) as { id: string; conversation_id: string; created_at: string }[];
      if (!declined.length) return [];

      const questions = check(
        await db
          .from("messages")
          .select("conversation_id, content, created_at")
          .eq("business_id", businessId)
          .eq("role", "visitor")
          .in("conversation_id", [...new Set(declined.map((d) => d.conversation_id))])
          .order("seq"),
      ) as { conversation_id: string; content: string; created_at: string }[];

      return declined.map((d) => ({
        messageId: d.id,
        conversationId: d.conversation_id,
        // The question is the visitor message written in the same exchange.
        question:
          questions.findLast(
            (q) => q.conversation_id === d.conversation_id && q.created_at <= d.created_at,
          )?.content ?? "",
        createdAt: d.created_at,
      }));
    },

    async listFollowUps(businessId) {
      const rows = check(
        await db
          .from("follow_ups")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(200),
      ) as {
        id: string;
        conversation_id: string | null;
        email: string;
        question: string;
        status: FollowUp["status"];
        created_at: string;
      }[];
      return rows.map((r) => ({
        id: r.id,
        businessId,
        conversationId: r.conversation_id,
        email: r.email,
        question: r.question,
        status: r.status,
        createdAt: r.created_at,
      }));
    },

    async setFollowUpStatus(businessId, id, status) {
      check(await db.from("follow_ups").update({ status }).eq("business_id", businessId).eq("id", id));
    },

    async listTestCases(businessId) {
      const rows = check(
        await db.from("test_cases").select("*").eq("business_id", businessId).order("created_at"),
      ) as { id: string; question: string; expected: string; key_facts: string[]; should_answer: boolean }[];
      return rows.map((r) => ({
        id: r.id,
        businessId,
        question: r.question,
        expected: r.expected,
        keyFacts: r.key_facts ?? [],
        shouldAnswer: r.should_answer,
      }));
    },

    async addTestCase(businessId, test) {
      const row = check(
        await db
          .from("test_cases")
          .insert({
            business_id: businessId,
            question: test.question,
            expected: test.expected,
            key_facts: test.keyFacts,
            should_answer: test.shouldAnswer,
          })
          .select("id")
          .single(),
      ) as { id: string };
      return { ...test, id: row.id, businessId } satisfies TestCase;
    },

    async deleteTestCase(businessId, id) {
      check(await db.from("test_cases").delete().eq("business_id", businessId).eq("id", id));
    },

    async saveEvalRun(run) {
      const row = check(
        await db
          .from("eval_runs")
          .insert({
            business_id: run.businessId,
            mode: run.mode,
            model: run.model,
            total: run.total,
            correct: run.correct,
            wrong: run.wrong,
            declined_correctly: run.declinedCorrectly,
            ungrounded: run.ungrounded,
            results: run.results,
          })
          .select("id, created_at")
          .single(),
      ) as { id: string; created_at: string };
      return { ...run, id: row.id, createdAt: row.created_at };
    },

    async listEvalRuns(businessId) {
      const rows = check(
        await db
          .from("eval_runs")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(20),
      ) as {
        id: string;
        created_at: string;
        mode: EvalRun["mode"];
        model: string | null;
        total: number;
        correct: number;
        wrong: number;
        declined_correctly: number;
        ungrounded: number;
        results: EvalRun["results"];
      }[];
      return rows.map((r) => ({
        id: r.id,
        businessId,
        createdAt: r.created_at,
        mode: r.mode,
        model: r.model,
        total: r.total,
        correct: r.correct,
        wrong: r.wrong,
        declinedCorrectly: r.declined_correctly,
        ungrounded: r.ungrounded,
        results: r.results,
      }));
    },

    async stats(businessId) {
      const count = async (table: string, filter?: (q: any) => any) => {
        let query = db.from(table).select("id", { count: "exact", head: true }).eq("business_id", businessId);
        if (filter) query = filter(query);
        const { count: n, error } = await query;
        if (error) throw new StoreError(error.message, 500);
        return n ?? 0;
      };
      const [conversations, questions, unanswered, helpful, notHelpful, openFollowUps, documents, passages, questionsToday] =
        await Promise.all([
          count("conversations"),
          count("messages", (q) => q.eq("role", "assistant")),
          count("messages", (q) => q.eq("answered", false)),
          count("messages", (q) => q.eq("feedback", 1)),
          count("messages", (q) => q.eq("feedback", -1)),
          count("follow_ups", (q) => q.eq("status", "open")),
          count("documents"),
          count("passages"),
          store.questionsToday(businessId),
        ]);
      return {
        conversations,
        questions,
        answered: questions - unanswered,
        unanswered,
        helpful,
        notHelpful,
        openFollowUps,
        documents,
        passages,
        questionsToday,
      };
    },
  };

  return store;
}
