"use client";

import { useRef } from "react";
import { useSavedKey } from "@/lib/client/key";
import { PROVIDERS } from "@/lib/llm";
import { KeyDialog } from "../KeyDialog";

/** Lets the person viewing the owner area try model answers with their own key. */
export function KeyStatus({ allowLocal }: { allowLocal: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saved = useSavedKey();
  return (
    <>
      <p className="form-foot">
        <button type="button" className="button button-quiet" onClick={() => dialog.current?.showModal()}>
          {saved ? "Change your key" : "Try it with your own key"}
        </button>
        <span>
          {saved
            ? `Using ${PROVIDERS[saved.provider].label} (${saved.model}) in this tab only.`
            : "Your key is used for your own chats and test runs in this tab. It is not saved."}
        </span>
      </p>
      <KeyDialog dialog={dialog} allowLocal={allowLocal} />
    </>
  );
}
