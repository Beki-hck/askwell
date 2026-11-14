"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { send } from "./api";

type Kind = "file" | "url" | "text";
const KINDS: { id: Kind; label: string }[] = [
  { id: "file", label: "Upload a file" },
  { id: "url", label: "Import a web page" },
  { id: "text", label: "Paste text" },
];

export function AddDocument({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("file");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setDone(false);
    start(async () => {
      const failed =
        kind === "file"
          ? await send("/api/documents", "POST", data)
          : await send(
              "/api/documents",
              "POST",
              kind === "url" ? { url: data.get("url") } : { title: data.get("title"), content: data.get("content") },
            );
      setError(failed);
      if (!failed) {
        form.reset();
        setDone(true);
        router.refresh();
      }
    });
  }

  return (
    <form className="panel add-doc" onSubmit={submit} aria-labelledby="add-doc-title">
      <h2 id="add-doc-title">Add a document</h2>
      <div className="segmented" role="radiogroup" aria-label="How to add it">
        {KINDS.map((k) => (
          <label key={k.id}>
            <input type="radio" name="kind" checked={kind === k.id} onChange={() => { setKind(k.id); setError(null); }} />
            <span>{k.label}</span>
          </label>
        ))}
      </div>

      {kind === "file" && (
        <div className="field">
          <label htmlFor="doc-file">PDF, .txt or .md file, up to 4 MB</label>
          <input id="doc-file" name="file" type="file" required accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" />
        </div>
      )}
      {kind === "url" && (
        <div className="field">
          <label htmlFor="doc-url">Web address of the page</label>
          <input id="doc-url" name="url" type="url" required placeholder="https://example.com/faq" />
        </div>
      )}
      {kind === "text" && (
        <>
          <div className="field">
            <label htmlFor="doc-title">Title</label>
            <input id="doc-title" name="title" required maxLength={160} placeholder="Returns policy" />
          </div>
          <div className="field">
            <label htmlFor="doc-content">Text</label>
            <textarea id="doc-content" name="content" required rows={7} placeholder={"Start a line with # to mark a heading.\n\n# Returns\nYou can return any item within 30 days."} />
          </div>
        </>
      )}

      <div className="form-foot">
        <button className="button" type="submit" disabled={disabled || pending}>
          {pending ? "Adding" : "Add document"}
        </button>
        {disabled && <p>The demo is read-only, so this button is off.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {done && <p role="status">Added. The assistant can answer from it now.</p>}
      </div>
    </form>
  );
}
