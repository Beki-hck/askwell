import type {
  Business,
  Conversation,
  DocumentRecord,
  EvalRun,
  ExchangeInput,
  FollowUp,
  Message,
  ScoredPassage,
  SourceType,
  Stats,
  TestCase,
} from "../types";

export interface NewDocument {
  title: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  content: string;
}

export type BusinessPatch = Partial<
  Pick<Business, "name" | "assistantName" | "greeting" | "tone" | "dailyLimit" | "suggestions">
>;

export interface UnansweredQuestion {
  messageId: string;
  conversationId: string;
  question: string;
  createdAt: string;
}

/**
 * Everything the app stores, behind one interface. Two implementations:
 * Supabase (Postgres with row-level security) for real deployments, and an
 * in-memory one that serves the demo when no database is configured.
 */
export interface Store {
  readonly kind: "memory" | "supabase";

  getBusiness(slug: string): Promise<Business | null>;
  updateBusiness(businessId: string, patch: BusinessPatch): Promise<Business>;

  listDocuments(businessId: string): Promise<DocumentRecord[]>;
  getDocument(businessId: string, id: string): Promise<DocumentRecord | null>;
  addDocument(businessId: string, doc: NewDocument): Promise<DocumentRecord>;
  deleteDocument(businessId: string, id: string): Promise<void>;

  search(business: Business, query: string, k?: number): Promise<ScoredPassage[]>;

  questionsToday(businessId: string): Promise<number>;
  logExchange(
    business: Business,
    input: ExchangeInput,
  ): Promise<{ conversationId: string; messageId: string }>;
  setFeedback(messageId: string, value: 1 | -1): Promise<void>;
  addFollowUp(
    business: Business,
    input: { conversationId: string | null; email: string; question: string },
  ): Promise<void>;

  listConversations(businessId: string): Promise<Conversation[]>;
  getMessages(businessId: string, conversationId: string): Promise<Message[]>;
  listUnanswered(businessId: string): Promise<UnansweredQuestion[]>;
  listFollowUps(businessId: string): Promise<FollowUp[]>;
  setFollowUpStatus(businessId: string, id: string, status: FollowUp["status"]): Promise<void>;

  listTestCases(businessId: string): Promise<TestCase[]>;
  addTestCase(businessId: string, test: Omit<TestCase, "id" | "businessId">): Promise<TestCase>;
  deleteTestCase(businessId: string, id: string): Promise<void>;
  saveEvalRun(run: Omit<EvalRun, "id" | "createdAt">): Promise<EvalRun>;
  listEvalRuns(businessId: string): Promise<EvalRun[]>;

  stats(businessId: string): Promise<Stats>;
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}•••@${domain ?? ""}`;
}
