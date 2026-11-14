"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import type { Business } from "@/lib/types";
import { send } from "./api";

const TONES = [
  { id: "warm", label: "Warm", hint: "Friendly, like a helpful member of staff" },
  { id: "plain", label: "Plain", hint: "Direct, no small talk" },
  { id: "formal", label: "Formal", hint: "Polite and precise" },
];

export function SettingsForm({ business, disabled }: { business: Business; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaved(false);
    start(async () => {
      const failed = await send("/api/settings", "PATCH", {
        name: data.get("name"),
        assistantName: data.get("assistantName"),
        greeting: data.get("greeting"),
        tone: data.get("tone"),
        dailyLimit: Number(data.get("dailyLimit")),
        suggestions: String(data.get("suggestions") ?? "").split("\n"),
      });
      setError(failed);
      if (!failed) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="settings">
      <div className="field">
        <label htmlFor="s-name">Business name</label>
        <input id="s-name" name="name" required maxLength={80} defaultValue={business.name} />
      </div>
      <div className="field">
        <label htmlFor="s-assistant">Assistant name</label>
        <input id="s-assistant" name="assistantName" required maxLength={40} defaultValue={business.assistantName} />
      </div>
      <div className="field field-wide">
        <label htmlFor="s-greeting">Greeting</label>
        <textarea id="s-greeting" name="greeting" required rows={3} maxLength={400} defaultValue={business.greeting} />
        <p>The first message a visitor sees when they open the chat box.</p>
      </div>
      <fieldset className="field field-wide">
        <legend>Tone</legend>
        <div className="choices">
          {TONES.map((tone) => (
            <label key={tone.id}>
              <input type="radio" name="tone" value={tone.id} defaultChecked={business.tone === tone.id} />
              <span>
                <strong>{tone.label}</strong>
                {tone.hint}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field field-wide">
        <label htmlFor="s-suggestions">Example questions</label>
        <textarea id="s-suggestions" name="suggestions" rows={4} defaultValue={business.suggestions.join("\n")} />
        <p>One per line, up to four. They appear as buttons under the greeting.</p>
      </div>
      <div className="field">
        <label htmlFor="s-limit">Daily question limit</label>
        <input id="s-limit" name="dailyLimit" type="number" required min={1} max={5000} defaultValue={business.dailyLimit} />
        <p>After this many questions in a day the chat box pauses until tomorrow. It caps what a model can cost you.</p>
      </div>
      <div className="form-foot field-wide">
        <button className="button" type="submit" disabled={disabled || pending}>
          {pending ? "Saving" : "Save changes"}
        </button>
        {disabled && <p>The demo is read-only, so this button is off.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p role="status">Saved.</p>}
      </div>
    </form>
  );
}
