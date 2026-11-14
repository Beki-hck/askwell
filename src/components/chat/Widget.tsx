"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { KeyDialog } from "../KeyDialog";
import { Chat, type ChatBusiness } from "./Chat";
import "./widget.css";

interface Props {
  business: ChatBusiness;
  hasServerModel: boolean;
  allowLocal: boolean;
  /** Inside the embed iframe the widget fills the frame and tells the host page its size. */
  embedded?: boolean;
  style?: CSSProperties;
}

/** The floating launcher and the chat panel it opens. */
export function Widget({ business, hasServerModel, allowLocal, embedded, style }: Props) {
  const [open, setOpen] = useState(false);
  const keyDialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  // When the panel closes, focus goes back to the button that opened it. This
  // runs after render because on phones the button is hidden while the panel is open.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (embedded) window.parent?.postMessage({ askwell: open ? "open" : "close" }, "*");
  }, [open, embedded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !keyDialog.current?.open) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="widget" data-embedded={embedded || undefined} data-open={open || undefined} style={style}>
      {open && (
        <section className="widget-panel" aria-label={`Chat with ${business.assistantName}`}>
          <header className="widget-head">
            <span className="widget-avatar" aria-hidden="true">
              {business.assistantName.slice(0, 1)}
            </span>
            <div>
              <strong>{business.assistantName}</strong>
              <span>{business.name}</span>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <Chat
            business={business}
            hasServerModel={hasServerModel}
            onOpenKey={() => keyDialog.current?.showModal()}
            autoFocus
          />
          <a className="widget-credit" href="/" target="_blank" rel="noopener">
            Answers by Askwell
          </a>
        </section>
      )}

      {(!open || !embedded) && (
        <button
          ref={launcher}
          type="button"
          className="widget-launcher"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
          {open ? "Close" : `Ask ${business.assistantName}`}
        </button>
      )}

      <KeyDialog dialog={keyDialog} allowLocal={allowLocal} />
    </div>
  );
}
