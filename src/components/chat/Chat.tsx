"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { keyHeaders, useSavedKey } from "@/lib/client/key";
import { errorMessage, readEvents } from "@/lib/client/stream";
import type { AnswerMode, Source } from "@/lib/types";
import "./chat.css";

export interface ChatBusiness {
  slug: string;
  name: string;
  assistantName: string;
  greeting: string;
  suggestions: string[];
  isDemo: boolean;
}

interface Turn {
  id: number;
  question: string;
  answer: string;
  sources: Source[];
  status: "streaming" | "done" | "error";
  answered: boolean | null;
  mode: AnswerMode | null;
  messageId: string | null;
  feedback: 1 | -1 | null;
  followUp: "idle" | "sending" | "sent";
  error: string | null;
}

type StreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | {
      type: "done";
      answer: string;
      answered: boolean;
      mode: AnswerMode;
      sources: Source[];
      conversationId: string;
      messageId: string;
    }
  | { type: "error"; message: string };

interface Props {
  business: ChatBusiness;
  /** Whether the site owner configured a model on the server. */
  hasServerModel: boolean;
  /** Called when an answer arrives with sources, and when a citation is opened. */
  onSources?: (sources: Source[]) => void;
  onOpenKey?: () => void;
  autoFocus?: boolean;
}

export function Chat({ business, hasServerModel, onSources, onOpenKey, autoFocus }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [openSource, setOpenSource] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const nextId = useRef(1);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const savedKey = useSavedKey();
  const busy = turns.some((t) => t.status === "streaming");
  const live = hasServerModel || savedKey !== null;

  useEffect(() => () => abort.current?.abort(), []);

  // Keep the newest text in view while it streams, unless the reader scrolled up.
  const pinned = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const patch = (id: number, change: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
    setTurns((all) =>
      all.map((t) => (t.id === id ? { ...t, ...(typeof change === "function" ? change(t) : change) } : t)),
    );

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    const id = nextId.current++;
    const history = turns
      .filter((t) => t.status === "done")
      .flatMap((t) => [
        { role: "user", content: t.question },
        { role: "assistant", content: t.answer },
      ]);
    setDraft("");
    pinned.current = true;
    setTurns((all) => [
      ...all,
      {
        id,
        question,
        answer: "",
        sources: [],
        status: "streaming",
        answered: null,
        mode: null,
        messageId: null,
        feedback: null,
        followUp: "idle",
        error: null,
      },
    ]);

    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", ...keyHeaders(savedKey) },
        body: JSON.stringify({ slug: business.slug, question, history, conversationId: conversationId.current }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));

      let finished = false;
      for await (const event of readEvents<StreamEvent>(response)) {
        if (event.type === "delta") {
          patch(id, (t) => ({ answer: t.answer + event.text }));
        } else if (event.type === "sources") {
          patch(id, { sources: event.sources });
        } else if (event.type === "error") {
          throw new Error(event.message);
        } else {
          finished = true;
          conversationId.current = event.conversationId;
          patch(id, {
            status: "done",
            answer: event.answer,
            sources: event.sources,
            answered: event.answered,
            mode: event.mode,
            messageId: event.messageId,
          });
          if (event.sources.length) onSources?.(event.sources);
        }
      }
      if (!finished) throw new Error("The answer was cut off. Ask again.");
    } catch (error) {
      if (controller.signal.aborted) return;
      patch(id, {
        status: "error",
        error: error instanceof Error && error.message ? error.message : "The assistant could not be reached.",
      });
    }
  }

  async function rate(turn: Turn, value: 1 | -1) {
    if (!turn.messageId || turn.feedback === value) return;
    patch(turn.id, { feedback: value });
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: turn.messageId, value }),
    }).catch(() => null);
    if (!response?.ok) patch(turn.id, { feedback: turn.feedback });
  }

  async function requestFollowUp(turn: Turn, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    patch(turn.id, { followUp: "sending", error: null });
    const response = await fetch("/api/follow-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: business.slug,
        email,
        question: turn.question,
        conversationId: conversationId.current,
      }),
    }).catch(() => null);
    if (response?.ok) patch(turn.id, { followUp: "sent" });
    else
      patch(turn.id, {
        followUp: "idle",
        error: response ? await errorMessage(response) : "Could not send. Check your connection.",
      });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <div className="chat">
      <div
        className="chat-scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        <div className="chat-log" role="log" aria-live="polite" aria-label={`Conversation with ${business.assistantName}`}>
          <p className="chat-bubble chat-bubble-them">{business.greeting}</p>

          {turns.length === 0 && business.suggestions.length > 0 && (
            <ul className="chat-suggestions" aria-label="Example questions">
              {business.suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => void ask(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {turns.map((turn) => (
            <div className="chat-turn" key={turn.id}>
              <p className="chat-bubble chat-bubble-me">{turn.question}</p>

              {turn.status === "error" && !turn.answer ? (
                <div className="chat-error" role="alert">
                  <p>{turn.error}</p>
                  <button type="button" onClick={() => { setTurns((all) => all.filter((t) => t.id !== turn.id)); void ask(turn.question); }}>
                    Ask again
                  </button>
                </div>
              ) : (
                <div className="chat-answer" data-answered={turn.answered ?? undefined}>
                  {!turn.answer && <TypingDots />}
                  <AnswerText
                    text={turn.answer}
                    quoted={turn.mode === "search" && turn.sources.length > 0}
                    onCite={(n) => {
                      const source = turn.sources.find((s) => s.n === n);
                      if (!source) return;
                      const key = `${turn.id}:${n}`;
                      setOpenSource((open) => (open === key ? null : key));
                      onSources?.([source]);
                    }}
                  />

                  {turn.sources.length > 0 && turn.status === "done" && (
                    <ul className="chat-sources" aria-label="Sources">
                      {turn.sources.map((source) => {
                        const key = `${turn.id}:${source.n}`;
                        const open = openSource === key;
                        return (
                          <li key={source.n}>
                            <button
                              type="button"
                              className="chat-source"
                              aria-expanded={open}
                              onClick={() => {
                                setOpenSource(open ? null : key);
                                onSources?.([source]);
                              }}
                            >
                              <span className="chat-source-n">{source.n}</span>
                              <span className="chat-source-title">
                                {source.documentTitle}
                                {source.heading && <span> / {source.heading}</span>}
                              </span>
                            </button>
                            {open && <blockquote className="chat-excerpt">{source.excerpt}</blockquote>}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {turn.status === "done" && turn.answered && turn.messageId && turn.sources.length > 0 && (
                    <div className="chat-rate">
                      <span>{turn.feedback ? "Thanks for telling us." : "Did this help?"}</span>
                      <button type="button" aria-pressed={turn.feedback === 1} onClick={() => void rate(turn, 1)}>
                        Yes
                      </button>
                      <button type="button" aria-pressed={turn.feedback === -1} onClick={() => void rate(turn, -1)}>
                        No
                      </button>
                    </div>
                  )}

                  {turn.status === "done" && turn.answered === false && (
                    turn.followUp === "sent" ? (
                      <p className="chat-sent" role="status">
                        Sent. Someone from {business.name} will reply by email.
                      </p>
                    ) : (
                      <form className="chat-followup" onSubmit={(e) => void requestFollowUp(turn, e)}>
                        <label htmlFor={`email-${turn.id}`}>Your email</label>
                        <div>
                          <input
                            id={`email-${turn.id}`}
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="name@example.com"
                          />
                          <button type="submit" disabled={turn.followUp === "sending"}>
                            {turn.followUp === "sending" ? "Sending" : "Ask a person"}
                          </button>
                        </div>
                        {turn.error && <p className="chat-form-error" role="alert">{turn.error}</p>}
                        {business.isDemo && (
                          <p className="chat-note">This is a public demo, so only a masked address is kept.</p>
                        )}
                      </form>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor={`ask-${business.slug}`}>
          Ask {business.assistantName} a question
        </label>
        <textarea
          id={`ask-${business.slug}`}
          rows={1}
          value={draft}
          maxLength={600}
          autoFocus={autoFocus}
          placeholder="Ask a question"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(draft);
            }
          }}
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send question">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M3 10h13M11 4.5 16.5 10 11 15.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>

      <p className="chat-mode">
        {live ? (
          <>Answers are written by an AI model from {business.name}&rsquo;s documents.</>
        ) : (
          <>Search-only mode: answers are quoted straight from the documents.</>
        )}{" "}
        {onOpenKey && (
          <button type="button" onClick={onOpenKey}>
            {savedKey ? "Change key" : "Use your own AI key"}
          </button>
        )}
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="chat-dots" role="status" aria-label="Looking through the documents">
      <i />
      <i />
      <i />
    </span>
  );
}

/** Renders answer text: paragraphs, simple lists, and [n] citation markers. */
function AnswerText({ text, quoted, onCite }: { text: string; quoted: boolean; onCite: (n: number) => void }) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/);
  const inline = (value: string): ReactNode[] =>
    value.split(/(\[\d+\])/).map((part, i) => {
      const cite = part.match(/^\[(\d+)\]$/);
      if (!cite) return part;
      const n = Number(cite[1]);
      return (
        <button key={i} type="button" className="chat-cite" onClick={() => onCite(n)} aria-label={`Show source ${n}`}>
          {n}
        </button>
      );
    });

  return (
    <div className="chat-text">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
        // In search mode everything after the "From …:" line is the document's own words.
        const fromDocument = quoted && i > 0;
        if (isList) {
          return (
            <ul key={i} className={fromDocument ? "chat-quote" : undefined}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={fromDocument ? "chat-quote" : undefined}>
            {lines.flatMap((l, j) => (j ? [<br key={`b${j}`} />, ...inline(l)] : inline(l)))}
          </p>
        );
      })}
    </div>
  );
}
