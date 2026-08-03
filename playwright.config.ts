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
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
