import { describe, expect, it } from "vitest";
import {
  buildApprovedEmail,
  buildAssignedEmail,
  buildDayBeforeEmail,
  buildSubmittedEmail,
  buildWeeklySummaryEmail,
} from "./templates";

describe("buildAssignedEmail", () => {
  it("addresses the engineer and links the job", () => {
    const email = buildAssignedEmail({
      jobNumber: "OPOC-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: "2026-08-10T09:00:00.000Z",
      engineerName: "Jamie Vance",
      deepLink: "https://opoc.example.com/office/jobs/job-1",
    });
    expect(email.subject).toContain("OPOC-2026-0042");
    expect(email.text).toContain("Jamie Vance");
    expect(email.text).toContain("https://opoc.example.com/office/jobs/job-1");
    expect(email.html).toContain("Riverside Retail Park");
  });

  it("says the job isn't scheduled yet, rather than a bogus date, when scheduledStart is null", () => {
    const email = buildAssignedEmail({
      jobNumber: "OPOC-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: null,
      engineerName: "Jamie Vance",
      deepLink: "https://opoc.example.com/office/jobs/job-1",
    });
    expect(email.text.toLowerCase()).toContain("isn't scheduled yet");
  });
});

describe("buildDayBeforeEmail", () => {
  it("says the job is scheduled for tomorrow", () => {
    const email = buildDayBeforeEmail({
      jobNumber: "OPOC-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: "2026-08-10T09:00:00.000Z",
      engineerName: "Jamie Vance",
      deepLink: "https://opoc.example.com/office/jobs/job-1",
    });
    expect(email.text.toLowerCase()).toContain("tomorrow");
  });
});

describe("buildSubmittedEmail", () => {
  it("addresses the manager and names the engineer who submitted", () => {
    const email = buildSubmittedEmail({
      jobNumber: "OPOC-2026-0042",
      siteName: "Riverside Retail Park",
      engineerName: "Jamie Vance",
      managerName: "Priya Shah",
      deepLink: "https://opoc.example.com/office/jobs/job-1",
    });
    expect(email.text).toContain("Priya Shah");
    expect(email.text).toContain("Jamie Vance");
    expect(email.subject.toLowerCase()).toContain("submitted");
  });
});

describe("buildApprovedEmail", () => {
  it("includes the PDF link when one exists", () => {
    const email = buildApprovedEmail({
      jobNumber: "OPOC-2026-0042",
      siteName: "Riverside Retail Park",
      clientName: "Acme Corp",
      deepLink: "https://opoc.example.com/office/jobs/job-1",
      pdfUrl: "https://opoc.example.com/reports/job-1.pdf",
    });
    expect(email.text).toContain("https://opoc.example.com/reports/job-1.pdf");
  });

  it("still sends, without a broken link, when no PDF exists yet", () => {
    const email = buildApprovedEmail({
      jobNumber: "OPOC-2026-0042",
      siteName: "Riverside Retail Park",
      clientName: "Acme Corp",
      deepLink: "https://opoc.example.com/office/jobs/job-1",
      pdfUrl: null,
    });
    expect(email.text).not.toContain("null");
    expect(email.text.toLowerCase()).toContain("finalised");
  });
});

describe("buildWeeklySummaryEmail", () => {
  it("reports the counts passed in", () => {
    const email = buildWeeklySummaryEmail({
      projectName: "Acme Rollout",
      weekLabel: "3–9 Aug",
      completedCount: 5,
      scheduledCount: 12,
      openIssueCount: 2,
      deepLink: "https://opoc.example.com/office/jobs?project_id=p1",
    });
    expect(email.text).toContain("5 job(s) completed");
    expect(email.text).toContain("12 scheduled");
    expect(email.text).toContain("2 open issue(s)");
    expect(email.subject).toContain("Acme Rollout");
  });
});
