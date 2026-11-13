export type Tone = "warm" | "plain" | "formal";

export interface Business {
  id: string;
  slug: string;
  name: string;
  assistantName: string;
  greeting: string;
  tone: Tone;
  dailyLimit: number;
  isDemo: boolean;
  suggestions: string[];
}

export type SourceType = "text" | "pdf" | "url";

export interface DocumentRecord {
  id: string;
  businessId: string;
  title: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  content: string;
  passageCount: number;
  createdAt: string;
}

export interface Passage {
  id: string;
  documentId: string;
  documentTitle: string;
  heading: string | null;
  position: number;
  content: string;
}

export interface ScoredPassage extends Passage {
  score: number;
  /**
   * Share of the question this passage covers, from 0 to 1. Rare words count
   * for more, and a word found nowhere in the documents counts for the most.
   */
  coverage: number;
  /** Meaning-based similarity from the database, when embeddings are available. */
  similarity?: number | null;
}

/** A passage as it is shown under an answer. */
export interface Source {
  n: number;
  passageId: string;
  documentId: string;
  documentTitle: string;
  heading: string | null;
  excerpt: string;
}

export type AnswerMode = "model" | "search";

export interface Message {
  id: string;
  conversationId: string;
  role: "visitor" | "assistant";
  content: string;
  sources: Source[];
  answered: boolean | null;
  mode: AnswerMode | null;
  feedback: 1 | -1 | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  businessId: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  unanswered: number;
  preview: string;
}

export interface FollowUp {
  id: string;
  businessId: string;
  conversationId: string | null;
  email: string;
  question: string;
  status: "open" | "done";
  createdAt: string;
}

export interface TestCase {
  id: string;
  businessId: string;
  question: string;
  expected: string;
  /** Facts the answer must contain. `a|b` means either wording counts. */
  keyFacts: string[];
  /** False when the documents do not cover it and the right move is to decline. */
  shouldAnswer: boolean;
}

export type Verdict =
  | "correct"
  | "wrong"
  | "declined_correctly"
  | "declined_wrongly"
  | "answered_wrongly";

export interface TestResult {
  testCaseId: string;
  question: string;
  expected: string;
  answer: string;
  answered: boolean;
  verdict: Verdict;
  missingFacts: string[];
  grounded: boolean;
  unsupported: string[];
  sources: Source[];
}

export interface EvalRun {
  id: string;
  businessId: string;
  createdAt: string;
  mode: AnswerMode;
  model: string | null;
  total: number;
  correct: number;
  wrong: number;
  declinedCorrectly: number;
  ungrounded: number;
  results: TestResult[];
}

export interface Stats {
  conversations: number;
  questions: number;
  answered: number;
  unanswered: number;
  helpful: number;
  notHelpful: number;
  openFollowUps: number;
  documents: number;
  passages: number;
  questionsToday: number;
}

export interface ExchangeInput {
  conversationId: string | null;
  question: string;
  answer: string;
  sources: Source[];
  answered: boolean;
  mode: AnswerMode;
}

export class StoreError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
