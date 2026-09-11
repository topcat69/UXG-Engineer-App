import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

// Falls back to local Supabase dev keys when not already in the
// environment (CI exports them explicitly; see .github/workflows/ci.yml).
dotenv.config({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Only set in dev sandboxes that pre-install Chromium at a fixed path
    // (see CLAUDE.md/README for details); normal Playwright browser
    // resolution applies everywhere else, including CI.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    // A production build, not `next dev`: the offline-workflow suite relies
    // on the service worker replaying a cached navigation while the network
    // is down, and Next's own guidance is explicit that dev mode isn't a
    // reliable reference for that — Turbopack's dev-mode module wiring
    // isn't stable across a cached-then-replayed reload the way a real
    // build's static output is. Confirmed: this suite is flaky under
    // `next dev` and consistently green under `next build && next start`.
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
