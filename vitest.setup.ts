import dotenv from "dotenv";
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// Falls back to the local Supabase dev keys when they're not already in the
// environment (CI exports them explicitly; see .github/workflows/ci.yml).
dotenv.config({ path: ".env.local" });
