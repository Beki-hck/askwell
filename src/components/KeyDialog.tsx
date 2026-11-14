"use client";

import { type FormEvent, type RefObject, useState } from "react";
import { type SavedKey, useSavedKey, writeKey } from "@/lib/client/key";
import { PROVIDERS, type ProviderId } from "@/lib/llm";
import "./key-dialog.css";

/**
 * Lets a visitor try the live model with their own key. The key is kept in
 * this browser tab only and is never stored on the server.
 */
export function KeyDialog({ dialog, allowLocal }: { dialog: RefObject<HTMLDialogElement | null>; allowLocal: boolean }) {
  const saved = useSavedKey();
  const [provider, setProvider] = useState<ProviderId>(saved?.provider ?? "anthropic");
  const [model, setModel] = useState(saved?.model ?? "");
  const info = PROVIDERS[provider];
  const ids = (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => allowLocal || id !== "ollama");

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const apiKey = String(new FormData(event.currentTarget).get("apiKey") ?? "").trim();
    const next: SavedKey = { provider, apiKey, model: model.trim() || info.defaultModel };
    writeKey(next);
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className="key-dialog"
      aria-labelledby="key-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <form onSubmit={save}>
        <h2 id="key-title">Use your own AI key</h2>
        <p>
          With a key, a real model writes each answer from the documents. Without one, the assistant quotes the
          matching passage instead. Your key stays in this browser tab, is sent only with your own questions, and
          is gone when you close the tab.
        </p>

        <label htmlFor="key-provider">Provider</label>
        <select
          id="key-provider"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as ProviderId);
            setModel("");
          }}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {PROVIDERS[id].label}
            </option>
          ))}
        </select>

        {info.needsKey ? (
          <>
            <label htmlFor="key-value">API key</label>
            <input
              id="key-value"
              name="apiKey"
              type="password"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder={info.keyHint}
              defaultValue={saved?.provider === provider ? saved.apiKey : ""}
              key={provider}
            />
          </>
        ) : (
          <p className="key-hint">Ollama runs on your own computer and needs no key. Start it before you ask.</p>
        )}

        <label htmlFor="key-model">Model</label>
        <input
          id="key-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={info.defaultModel}
          spellCheck={false}
          autoComplete="off"
        />
        <p className="key-hint">Leave empty to use {info.defaultModel}.</p>

        <div className="key-actions">
          {saved && (
            <button
              type="button"
              className="key-remove"
              onClick={() => {
                writeKey(null);
                dialog.current?.close();
              }}
            >
              Remove key
            </button>
          )}
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="key-save">
            Save key
          </button>
        </div>
      </form>
    </dialog>
  );
}
