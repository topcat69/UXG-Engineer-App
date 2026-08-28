import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // tests/e2e is Playwright's territory (its own test() implementation) —
    // vitest's default include glob matches *.spec.ts too, so it must be
    // excluded explicitly or the two runners collide.
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    // Most test files are pure/unit and don't care, but tests/rls.test.ts
    // and tests/migration.test.ts both mutate the same live local Postgres
    // instance with no isolation between them — Vitest's default parallel
    // file execution let migration.test.ts's inserted job transiently push
    // rls.test.ts's exact "60 seeded jobs" count to 61. Files still run as
    // fast as their own content allows; only cross-file parallelism is off.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
