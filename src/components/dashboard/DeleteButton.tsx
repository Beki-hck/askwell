"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { send } from "./api";

/** Delete with a second click to confirm, so nothing is removed by accident. */
export function DeleteButton({ url, label, confirm, disabled }: { url: string; label: string; confirm: string; disabled: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (disabled) return null;

  if (!armed) {
    return (
      <button type="button" className="link-button" aria-label={label} onClick={() => setArmed(true)}>
        Delete
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={confirm}>
      <span>{error ?? confirm}</span>
      <button
        type="button"
        className="link-button danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const failed = await send(url, "DELETE");
            setError(failed);
            if (!failed) router.refresh();
          })
        }
      >
        {pending ? "Deleting" : "Yes, delete"}
      </button>
      <button type="button" className="link-button" onClick={() => setArmed(false)}>
        Keep
      </button>
    </span>
  );
}
