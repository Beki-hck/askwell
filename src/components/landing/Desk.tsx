"use client";

import { useEffect, useRef, useState } from "react";
import { Chat, type ChatBusiness } from "../chat/Chat";
import { DocumentBody } from "../DocumentBody";
import { KeyDialog } from "../KeyDialog";

interface Props {
  business: ChatBusiness;
  hasServerModel: boolean;
  allowLocal: boolean;
  documents: { id: string; title: string; content: string }[];
}

/**
 * The live demo on the home page: the assistant on one side, the business's
 * documents on the other. When an answer arrives, the document it came from
 * opens and the passage it used is marked with a highlighter.
 */
export function Desk({ business, hasServerModel, allowLocal, documents }: Props) {
  const [activeId, setActiveId] = useState(documents[0]?.id ?? "");
  const [marked, setMarked] = useState<{ documentId: string; heading: string | null; at: number } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const keyDialog = useRef<HTMLDialogElement>(null);
  const active = documents.find((d) => d.id === activeId) ?? documents[0];

  // Bring the marked passage into view inside the sheet, without moving the page.
  useEffect(() => {
    const container = sheet.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>("[data-marked]");
    container.scrollTo({ top: target ? Math.max(target.offsetTop - 16, 0) : 0, behavior: "smooth" });
  }, [marked, activeId]);

  return (
    <div className="desk">
      <div className="desk-docs">
        <div className="desk-tabs" role="tablist" aria-label={`${business.name} documents`}>
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              role="tab"
              aria-selected={doc.id === active?.id}
              onClick={() => {
                setActiveId(doc.id);
                setMarked(null);
              }}
            >
              {doc.title}
            </button>
          ))}
        </div>
        <div className="desk-sheet" ref={sheet} role="tabpanel" tabIndex={0} aria-label={active?.title}>
          {active && (
            <DocumentBody
              // Remount on every new citation so the highlighter stroke is drawn again.
              key={`${active.id}:${marked?.at ?? 0}`}
              content={active.content}
              level={3}
              highlight={marked?.documentId === active.id ? marked.heading : undefined}
            />
          )}
        </div>
      </div>

      <div className="desk-chat">
        <div className="desk-chat-head">
          <span aria-hidden="true">{business.assistantName.slice(0, 1)}</span>
          <div>
            <strong>{business.assistantName}</strong>
            <small>{business.name}</small>
          </div>
        </div>
        <Chat
          business={business}
          hasServerModel={hasServerModel}
          onOpenKey={() => keyDialog.current?.showModal()}
          onSources={(sources) => {
            const first = sources[0];
            if (!first) return;
            setActiveId(first.documentId);
            setMarked({ documentId: first.documentId, heading: first.heading, at: Date.now() });
          }}
        />
      </div>

      <KeyDialog dialog={keyDialog} allowLocal={allowLocal} />
    </div>
  );
}
