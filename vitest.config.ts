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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
