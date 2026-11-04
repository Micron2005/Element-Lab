import { BETA_COOKIE, isBetaCookie } from "../../../lib/beta";
import {
  buildFeedbackIssueBody,
  buildFeedbackIssueTitle,
  sanitizeFeedbackInput,
} from "../../../lib/feedback";

function hasBetaCookie(request: Request): boolean {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .some((part) => {
      const [name, ...value] = part.trim().split("=");
      return name === BETA_COOKIE && isBetaCookie(value.join("="));
    });
}

export async function POST(request: Request) {
  if (!hasBetaCookie(request)) {
    return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid-report" }, { status: 400 });
  }
  const report = sanitizeFeedbackInput(raw, new URL(request.url).origin);
  if (!report) {
    return Response.json({ ok: false, reason: "invalid-report" }, { status: 400 });
  }

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const repo = process.env.GITHUB_FEEDBACK_REPO || "Micron2005/Element-Lab";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Element-Lab-Beta-Feedback",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: buildFeedbackIssueTitle(report.kind, report.whatHappened),
        body: buildFeedbackIssueBody(report),
        labels: ["beta-feedback", report.kind],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return Response.json({ ok: false, reason: "issue-create-failed" }, { status: 502 });
    }
    const issue = await response.json() as { html_url?: unknown };
    if (typeof issue.html_url !== "string") {
      return Response.json({ ok: false, reason: "issue-create-failed" }, { status: 502 });
    }
    return Response.json({ ok: true, url: issue.html_url });
  } catch {
    return Response.json({ ok: false, reason: "issue-create-failed" }, { status: 502 });
  }
}
