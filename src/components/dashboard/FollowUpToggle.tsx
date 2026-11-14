"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { send } from "./api";

export function FollowUpToggle({ id, status, disabled }: { id: string; status: "open" | "done"; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (disabled) return <span>{status === "done" ? "Replied" : "Waiting"}</span>;

  return (
    <>
      <button
        type="button"
        className="link-button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(await send(`/api/follow-ups/${id}`, "PATCH", { status: status === "open" ? "done" : "open" }));
            router.refresh();
          })
        }
      >
        {status === "open" ? "Mark as replied" : "Reopen"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
