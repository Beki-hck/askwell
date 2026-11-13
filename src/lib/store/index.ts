import "server-only";
import { supabaseConfigured } from "../supabase/config";
import { createClient } from "../supabase/server";
import { createMemoryStore } from "./memory";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

type MemoryStore = ReturnType<typeof createMemoryStore>;
const globals = globalThis as { __askwellMemory?: MemoryStore };

/**
 * The store for this request: Postgres when Supabase is configured, the
 * built-in demo data when it is not.
 */
export async function getStore(): Promise<Store> {
  if (supabaseConfigured) return createSupabaseStore(await createClient());
  // One shared instance per server process, surviving hot reloads in development.
  const memory = (globals.__askwellMemory ??= createMemoryStore());
  await memory.ready;
  return memory;
}

export type { Store } from "./types";
