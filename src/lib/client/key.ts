"use client";

import { useSyncExternalStore } from "react";
import type { ProviderId } from "../llm";

export interface SavedKey {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

const STORAGE = "askwell.key";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: SavedKey | null } = { raw: null, value: null };

/**
 * The visitor's own AI key. It is kept in sessionStorage, so it is gone when
 * the tab closes, and it is sent only as a header on their own requests.
 */
export function readKey(): SavedKey | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE);
  } catch {
    return null;
  }
  if (raw === cached.raw) return cached.value;
  let value: SavedKey | null = null;
  try {
    value = raw ? (JSON.parse(raw) as SavedKey) : null;
  } catch {
    value = null;
  }
  cached = { raw, value };
  return value;
}

export function writeKey(key: SavedKey | null): void {
  try {
    if (key) sessionStorage.setItem(STORAGE, JSON.stringify(key));
    else sessionStorage.removeItem(STORAGE);
  } catch {
    // Storage is blocked (private window). The key simply is not remembered.
  }
  for (const notify of listeners) notify();
}

export function useSavedKey(): SavedKey | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    readKey,
    () => null,
  );
}

export function keyHeaders(key: SavedKey | null): Record<string, string> {
  if (!key) return {};
  return {
    "x-askwell-provider": key.provider,
    "x-askwell-key": key.apiKey,
    "x-askwell-model": key.model,
  };
}
