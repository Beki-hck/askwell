import "server-only";
import { DEMO_BUSINESS } from "./demo-data";
import { getStore, type Store } from "./store";
import { toBusiness } from "./store/supabase";
import { supabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import { type Business, StoreError } from "./types";

export const DEMO_SLUG = DEMO_BUSINESS.slug;

export interface Viewer {
  store: Store;
  business: Business;
  /** True for the public demo: everything is visible, nothing can be changed. */
  readOnly: boolean;
  email: string | null;
}

/** Local runs and tests may edit the demo; a public deployment may not. */
const demoWritable = () =>
  process.env.ASKWELL_DEMO_WRITABLE === "1" ||
  (process.env.NODE_ENV !== "production" && process.env.ASKWELL_DEMO_WRITABLE !== "0");

/**
 * Who is looking at the owner area. A signed-in owner gets their own business
 * (created on first visit); everyone else gets the demo business.
 */
export async function getViewer(): Promise<Viewer> {
  const store = await getStore();

  if (supabaseConfigured) {
    const db = await createClient();
    const { data } = await db.auth.getUser();
    if (data.user) {
      const columns = "id, slug, name, assistant_name, greeting, tone, daily_limit, is_demo, suggestions";
      let { data: row } = await db.from("businesses").select(columns).eq("owner_id", data.user.id).maybeSingle();
      if (!row) {
        const handle = (data.user.email ?? "business").split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const created = await db
          .from("businesses")
          .insert({
            owner_id: data.user.id,
            slug: `${handle.slice(0, 24).replace(/^-+|-+$/g, "") || "business"}-${crypto.randomUUID().slice(0, 6)}`,
            name: "My business",
          })
          .select(columns)
          .single();
        if (created.error) throw new StoreError(created.error.message, 500);
        row = created.data;
      }
      return { store, business: toBusiness(row), readOnly: false, email: data.user.email ?? null };
    }
  }

  const business = await store.getBusiness(DEMO_SLUG);
  if (!business) throw new StoreError("The demo business has not been set up in the database yet.", 500);
  return { store, business, readOnly: !demoWritable(), email: null };
}

/** For routes that change something. Rejects the read-only demo. */
export async function getOwner(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer.readOnly) {
    throw new StoreError("The demo is read-only. Sign in to set up your own assistant.", 403);
  }
  return viewer;
}
