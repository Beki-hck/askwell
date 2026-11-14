import { defineConfig, devices } from "@playwright/test";

// Two copies of the built app: one where the demo can be edited (as on a
// developer's machine) and one read-only (as on the public site).
const server = (port: number, writable: boolean) => ({
  command: `npx next start -p ${port}`,
  url: `http://localhost:${port}/login`,
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
  env: { ASKWELL_DEMO_WRITABLE: writable ? "1" : "0", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
});

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3210", trace: "off" },
  webServer: [server(3210, true), server(3211, false)],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /visitor\.spec\.ts/ },
  ],
});
