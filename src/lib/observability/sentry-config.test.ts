import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-config";

describe("sentryOptions", () => {
  it("returns null when no DSN is configured", () => {
    expect(sentryOptions(undefined)).toBeNull();
  });

  it("returns init options when a DSN is configured", () => {
    expect(sentryOptions("https://example@o0.ingest.sentry.io/1")).toEqual({
      dsn: "https://example@o0.ingest.sentry.io/1",
      tracesSampleRate: 0.1,
    });
  });
});
