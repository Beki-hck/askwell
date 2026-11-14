const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** A real project address, such as https://abcd.supabase.co (or a local http one). */
const validUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

/** A publishable key: a JWT or an sb_publishable_ key, which only use these characters. */
const validKey = (value: string) => /^[A-Za-z0-9._-]{20,}$/.test(value);

/**
 * Whether both settings are present and well formed. A setting pasted wrongly
 * (with masking dots or a missing piece, say) must not take the whole site
 * down, so the app then runs on its built-in demo data and says why in the log.
 */
export const supabaseProblem: string | null =
  !rawUrl && !rawKey
    ? null
    : !validUrl(rawUrl)
      ? "NEXT_PUBLIC_SUPABASE_URL is missing or is not a web address."
      : !validKey(rawKey)
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or contains characters a key cannot have."
        : null;

/** Without these two settings the app runs on its built-in demo data. */
export const supabaseConfigured = Boolean(rawUrl && rawKey && !supabaseProblem);

export const SUPABASE_URL = supabaseConfigured ? rawUrl.replace(/\/+$/, "") : "";
export const SUPABASE_KEY = supabaseConfigured ? rawKey : "";

if (supabaseProblem && typeof window === "undefined") {
  console.error(`Askwell: database settings ignored, running on demo data. ${supabaseProblem}`);
}
