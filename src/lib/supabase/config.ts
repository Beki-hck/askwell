export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Without these two settings the app runs on its built-in demo data. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
