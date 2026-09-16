import { describe, expect, it } from "vitest";
import { evaluateIntegrationFailureCount, FAILURE_THRESHOLD } from "./integration-failure-logic";

describe("evaluateIntegrationFailureCount", () => {
  it("is healthy with zero recent failures", () => {
    const result = evaluateIntegrationFailureCount("drive", 0);
    expect(result).toEqual({ key: "integration:drive", ok: true, detail: "no recent failures" });
  });

  it("does not flag a single transient failure", () => {
    const result = evaluateIntegrationFailureCount("resend", 1);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("below the alert threshold");
  });

  it("does not flag failures just under the threshold", () => {
    const result = evaluateIntegrationFailureCount("calendar", FAILURE_THRESHOLD - 1);
    expect(result.ok).toBe(true);
  });

  it("flags once the count reaches the threshold", () => {
    const result = evaluateIntegrationFailureCount("monday", FAILURE_THRESHOLD);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain(`${FAILURE_THRESHOLD} failures`);
  });

  it("stays flagged well past the threshold", () => {
    const result = evaluateIntegrationFailureCount("drive", FAILURE_THRESHOLD + 10);
    expect(result.ok).toBe(false);
  });
});
