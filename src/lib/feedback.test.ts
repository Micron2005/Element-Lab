import { describe, expect, it } from "vitest";
import {
  buildFeedbackIssueBody,
  buildFeedbackIssueTitle,
  sanitizeFeedbackInput,
} from "./feedback";

const metadata = {
  path: "/bench",
  locale: "es",
  viewport: "390×844",
  userAgent: "Playwright",
  activeBetaFeatures: ["report-problem"],
  commit: "abc1234",
};

describe("beta feedback builders", () => {
  it("prefixes titles with the kind and truncates the summary to 60 characters", () => {
    const title = buildFeedbackIssueTitle("Bug", "x".repeat(80));
    expect(title).toBe(`[Beta] Bug: ${"x".repeat(60)}`);
  });

  it("includes metadata and an optional shared experiment URL in the issue body", () => {
    const report = sanitizeFeedbackInput({
      kind: "Idea",
      whatHappened: "Add a better experiment export.",
      whatExpected: "A reusable link.",
      metadata: { ...metadata, shareUrl: "https://lab.example/bench#share=payload" },
    });
    expect(report).not.toBeNull();
    const body = buildFeedbackIssueBody(report!);
    expect(body).toContain("| Page | /bench |");
    expect(body).toContain("| Locale | es |");
    expect(body).toContain("| Viewport | 390×844 |");
    expect(body).toContain("| Commit | abc1234 |");
    expect(body).toContain("| Shared experiment | https://lab.example/bench#share=payload |");
    expect(body).toContain("A reusable link.");
  });

  it("strips control characters and caps both text fields", () => {
    const report = sanitizeFeedbackInput({
      kind: "Confusing",
      whatHappened: `A\u0001${"x".repeat(5000)}`,
      whatExpected: `B\u0007${"y".repeat(5000)}`,
      metadata,
    });
    expect(report?.whatHappened).toHaveLength(4000);
    expect(report?.whatHappened).not.toContain("\u0001");
    expect(report?.whatExpected).toHaveLength(4000);
    expect(report?.whatExpected).not.toContain("\u0007");
  });

  it("escapes pipes and newlines in the summary table cell", () => {
    const report = sanitizeFeedbackInput({
      kind: "Bug",
      whatHappened: "The value | broke\ninto a new row.",
      metadata,
    });
    const body = buildFeedbackIssueBody(report!);
    expect(body).toContain("| Summary | The value \\| broke<br>into a new row. |");
    expect(body).not.toContain("| into a new row.");
  });
});
