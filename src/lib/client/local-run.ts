"use client";

import { useSyncExternalStore } from "react";
import type { EvalRun } from "../types";

const key = (businessId: string) => `askwell.run.${businessId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: EvalRun | null }>();

/**
 * A test run the server did not keep. The public demo is read-only, so a
 * visitor's run is remembered in their own browser instead and shown only to
 * them.
 */
function readLocalRun(businessId: string): EvalRun | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(businessId));
  } catch {
    return null;
  }
  const hit = cache.get(businessId);
  if (hit && hit.raw === raw) return hit.value;
  let value: EvalRun | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as EvalRun) : null;
    value = parsed && Array.isArray(parsed.results) && typeof parsed.createdAt === "string" ? parsed : null;
  } catch {
    value = null;
  }
  cache.set(businessId, { raw, value });
  return value;
}

export function writeLocalRun(businessId: string, run: EvalRun): void {
  try {
    localStorage.setItem(key(businessId), JSON.stringify(run));
  } catch {
    // Storage is blocked (private window). The run stays on screen until the page is left.
  }
  for (const notify of listeners) notify();
}

export function useLocalRun(businessId: string): EvalRun | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => readLocalRun(businessId),
    () => null,
  );
}

