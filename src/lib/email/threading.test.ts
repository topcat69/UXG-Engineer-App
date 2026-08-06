import { describe, expect, it } from "vitest";
import { buildEmailHeaders, emailThreadRootId } from "./threading";

describe("emailThreadRootId", () => {
  it("is deterministic for a given job id", () => {
    expect(emailThreadRootId("job-1")).toBe(emailThreadRootId("job-1"));
  });

  it("differs between jobs", () => {
    expect(emailThreadRootId("job-1")).not.toBe(emailThreadRootId("job-2"));
  });
});

describe("buildEmailHeaders", () => {
  it("makes the first email's own Message-ID the thread root, with no References", () => {
    const headers = buildEmailHeaders("job-1", true, "unused");
    expect(headers.messageId).toBe(emailThreadRootId("job-1"));
    expect(headers.references).toBeUndefined();
    expect(headers.inReplyTo).toBeUndefined();
  });

  it("gives later emails a fresh Message-ID that references the root", () => {
    const headers = buildEmailHeaders("job-1", false, "fresh-id");
    expect(headers.messageId).toBe("<fresh-id@uxgengineering.local>");
    expect(headers.references).toBe(emailThreadRootId("job-1"));
    expect(headers.inReplyTo).toBe(emailThreadRootId("job-1"));
  });

  it("every later email for the same job references the same root, keeping the thread together", () => {
    const first = buildEmailHeaders("job-1", false, "email-a");
    const second = buildEmailHeaders("job-1", false, "email-b");
    expect(first.references).toBe(second.references);
    expect(first.messageId).not.toBe(second.messageId);
  });
});
