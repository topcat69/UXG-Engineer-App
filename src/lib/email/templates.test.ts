import { describe, expect, it } from "vitest";
import {
  buildApprovedEmail,
  buildAssignedEmail,
  buildCancelledEmail,
  buildDayBeforeEmail,
  buildScheduledEmail,
  buildSubmittedEmail,
  buildWeeklySummaryEmail,
} from "./templates";

describe("buildAssignedEmail", () => {
  it("addresses the engineer and links the job", () => {
    const email = buildAssignedEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: "2026-08-10T09:00:00.000Z",
      engineerName: "Jamie Vance",
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.subject).toContain("UXG-2026-0042");
    expect(email.text).toContain("Jamie Vance");
    expect(email.text).toContain("https://uxgengineering.example.com/office/jobs/job-1");
    expect(email.html).toContain("Riverside Retail Park");
  });

  it("says the job isn't scheduled yet, rather than a bogus date, when scheduledStart is null", () => {
    const email = buildAssignedEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: null,
      engineerName: "Jamie Vance",
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.text.toLowerCase()).toContain("isn't scheduled yet");
  });
});

describe("buildScheduledEmail", () => {
  const base = {
    jobNumber: "UXG-2026-0042",
    clientName: "Acme Corp",
    siteName: "Riverside Retail Park",
    siteAddress: "12 Riverside Way, Leeds, LS1 4AB",
    scheduledStart: "2026-08-21T09:00:00.000Z",
    scheduledEnd: "2026-08-21T11:00:00.000Z",
    engineerName: "Jamie Vance",
    jobType: "Install",
    priority: "High",
    description: "Replace faulty LED panel",
    jobInformation: "Access via loading bay",
    slaRequirementDetail: "4 hour response",
    equipment: [{ model: "Panel-X200", serial: "SN-001" }],
    accessNotes: "Ring bell twice",
    siteContactName: "Sam Okafor",
    siteContactPhone: "01234 567890",
    deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
  };

  it("subject starts with 'New Job Scheduled' then the job number", () => {
    const email = buildScheduledEmail(base, []);
    expect(email.subject).toBe("New Job Scheduled — UXG-2026-0042");
  });

  it("includes the full job detail set in the body", () => {
    const email = buildScheduledEmail(base, []);
    expect(email.text).toContain("Acme Corp");
    expect(email.text).toContain("Riverside Retail Park");
    expect(email.text).toContain("12 Riverside Way, Leeds, LS1 4AB");
    expect(email.text).toContain("Install");
    expect(email.text).toContain("High");
    expect(email.text).toContain("Replace faulty LED panel");
    expect(email.text).toContain("Access via loading bay");
    expect(email.text).toContain("4 hour response");
    expect(email.text).toContain("Panel-X200 (SN-001)");
    expect(email.text).toContain("Ring bell twice");
    expect(email.text).toContain("Sam Okafor (01234 567890)");
    expect(email.text).toContain(base.deepLink);
  });

  it("says nothing about a client when the site has none", () => {
    const email = buildScheduledEmail({ ...base, clientName: null }, []);
    expect(email.text).not.toContain("Client:");
  });

  it("names attached files when there are any", () => {
    const email = buildScheduledEmail(base, ["RAMS.pdf", "Site-plan.pdf"]);
    expect(email.text).toContain("Attached: RAMS.pdf, Site-plan.pdf");
  });

  it("says nothing about attachments when there are none", () => {
    const email = buildScheduledEmail(base, []);
    expect(email.text).not.toContain("Attached:");
  });

  it("shows a single time-of-day range for a same-day job, a full date range for a multi-day one", () => {
    const sameDay = buildScheduledEmail(base, []);
    expect(sameDay.text).not.toContain(" to ");

    const multiDay = buildScheduledEmail({ ...base, scheduledEnd: "2026-08-23T17:00:00.000Z" }, []);
    expect(multiDay.text).toContain(" to ");
  });
});

describe("buildDayBeforeEmail", () => {
  it("says the job is scheduled for tomorrow", () => {
    const email = buildDayBeforeEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: "2026-08-10T09:00:00.000Z",
      engineerName: "Jamie Vance",
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.text.toLowerCase()).toContain("tomorrow");
  });
});

describe("buildCancelledEmail", () => {
  it("says the job is cancelled, mentions the calendar removal, and links the job", () => {
    const email = buildCancelledEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: "2026-08-10T09:00:00.000Z",
      engineerName: "Jamie Vance",
      reason: null,
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.subject).toContain("cancelled");
    expect(email.text).toContain("Jamie Vance");
    expect(email.text.toLowerCase()).toContain("cancelled");
    expect(email.text.toLowerCase()).toContain("removed from your calendar");
    expect(email.text).toContain("https://uxgengineering.example.com/office/jobs/job-1");
  });

  it("includes the office's reason when one was given", () => {
    const email = buildCancelledEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: "2026-08-10T09:00:00.000Z",
      engineerName: "Jamie Vance",
      reason: "Client rescheduled to next month",
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.text).toContain("Client rescheduled to next month");
  });

  it("omits a reason line entirely when none was given", () => {
    const email = buildCancelledEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: "2026-08-10T09:00:00.000Z",
      engineerName: "Jamie Vance",
      reason: null,
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.text).not.toContain("Reason:");
  });

  it("still reads correctly when the job was never scheduled", () => {
    const email = buildCancelledEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      scheduledStart: null,
      engineerName: "Jamie Vance",
      reason: null,
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.text).not.toContain("scheduled for");
    expect(email.text.toLowerCase()).toContain("cancelled");
  });
});

describe("buildSubmittedEmail", () => {
  it("addresses the manager and names the engineer who submitted", () => {
    const email = buildSubmittedEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      engineerName: "Jamie Vance",
      managerName: "Priya Shah",
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
    });
    expect(email.text).toContain("Priya Shah");
    expect(email.text).toContain("Jamie Vance");
    expect(email.subject.toLowerCase()).toContain("submitted");
  });
});

describe("buildApprovedEmail", () => {
  it("includes the PDF link when one exists", () => {
    const email = buildApprovedEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      clientName: "Acme Corp",
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
      pdfUrl: "https://uxgengineering.example.com/reports/job-1.pdf",
    });
    expect(email.text).toContain("https://uxgengineering.example.com/reports/job-1.pdf");
  });

  it("still sends, without a broken link, when no PDF exists yet", () => {
    const email = buildApprovedEmail({
      jobNumber: "UXG-2026-0042",
      siteName: "Riverside Retail Park",
      clientName: "Acme Corp",
      deepLink: "https://uxgengineering.example.com/office/jobs/job-1",
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
      deepLink: "https://uxgengineering.example.com/office/jobs?project_id=p1",
    });
    expect(email.text).toContain("5 job(s) completed");
    expect(email.text).toContain("12 scheduled");
    expect(email.text).toContain("2 open issue(s)");
    expect(email.subject).toContain("Acme Rollout");
  });
});
