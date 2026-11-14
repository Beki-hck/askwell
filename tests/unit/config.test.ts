import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (url: string, key: string) => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
  vi.spyOn(console, "error").mockImplementation(() => {});
  return import("@/lib/supabase/config");
};

describe("database settings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("are used when both are well formed", async () => {
    const c = await load(" https://abcd.supabase.co/ ", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig_-x");
    expect(c.supabaseConfigured).toBe(true);
    expect(c.SUPABASE_URL).toBe("https://abcd.supabase.co");
  });

  it("are ignored, not fatal, when the key was pasted with masking dots", async () => {
    const c = await load("https://abcd.supabase.co", "eyJhbGci••••••••••••••••••••");
    expect(c.supabaseConfigured).toBe(false);
    expect(c.supabaseProblem).toContain("ANON_KEY");
  });

  it("are ignored when the address is not a web address", async () => {
    const c = await load("abcd.supabase.co", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig");
    expect(c.supabaseConfigured).toBe(false);
  });

  it("mean demo mode when both are absent", async () => {
    const c = await load("", "");
    expect(c.supabaseConfigured).toBe(false);
    expect(c.supabaseProblem).toBeNull();
  });
});
