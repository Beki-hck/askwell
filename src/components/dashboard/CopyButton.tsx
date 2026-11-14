"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <p className="form-foot">
      <button
        type="button"
        className="button button-quiet"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
          } catch {
            setState("failed");
          }
          setTimeout(() => setState("idle"), 2500);
        }}
      >
        Copy code
      </button>
      <span role="status">
        {state === "copied" && "Copied."}
        {state === "failed" && "Copying is blocked here. Select the line and copy it by hand."}
      </span>
    </p>
  );
}
