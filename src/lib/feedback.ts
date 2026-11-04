import { BETA_FEATURES, type BetaFeatureId } from "./beta";
import { tr, type Locale } from "./i18n";

export const FEEDBACK_MAX_LENGTH = 4000;
export const FEEDBACK_KINDS = ["Bug", "Idea", "Confusing"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export type FeedbackMetadata = {
  path: string;
  locale: Locale;
  viewport: string;
  userAgent: string;
  activeBetaFeatures: BetaFeatureId[];
  commit: string;
  shareUrl?: string;
};

export type FeedbackReport = {
  kind: FeedbackKind;
  whatHappened: string;
  whatExpected: string;
  metadata: FeedbackMetadata;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return stripControlChars(value).slice(0, maxLength).trim();
}

function sanitizeShareUrl(value: unknown, allowedOrigin?: string): string | undefined {
  const input = cleanText(value, 20_000);
  if (!input) return undefined;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (allowedOrigin && url.origin !== allowedOrigin) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function sanitizeFeedbackInput(value: unknown, allowedOrigin?: string): FeedbackReport | null {
  if (!isRecord(value)) return null;
  const kind = FEEDBACK_KINDS.find((candidate) => candidate === value.kind);
  const whatHappened = cleanText(value.whatHappened, FEEDBACK_MAX_LENGTH);
  if (!kind || !whatHappened) return null;

  const rawMetadata = isRecord(value.metadata) ? value.metadata : {};
  const activeFeatures = new Set(BETA_FEATURES.map(({ id }) => id));
  const activeBetaFeatures = Array.isArray(rawMetadata.activeBetaFeatures)
    ? rawMetadata.activeBetaFeatures.filter(
      (feature): feature is BetaFeatureId =>
        typeof feature === "string" && activeFeatures.has(feature as BetaFeatureId),
    )
    : [];
  const metadata: FeedbackMetadata = {
    path: cleanText(rawMetadata.path, 512) || "/",
    locale: rawMetadata.locale === "es" ? "es" : "en",
    viewport: cleanText(rawMetadata.viewport, 64) || "unknown",
    userAgent: cleanText(rawMetadata.userAgent, 512) || "unknown",
    activeBetaFeatures: [...new Set(activeBetaFeatures)],
    commit: cleanText(rawMetadata.commit, 40) || "local",
  };
  const shareUrl = sanitizeShareUrl(rawMetadata.shareUrl, allowedOrigin);
  if (shareUrl) metadata.shareUrl = shareUrl;

  return {
    kind,
    whatHappened,
    whatExpected: cleanText(value.whatExpected, FEEDBACK_MAX_LENGTH),
    metadata,
  };
}

export function escapeMarkdownTableCell(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r\n?|\n/g, "<br>");
}

function firstCharacters(value: string, count: number): string {
  return [...value].slice(0, count).join("");
}

export function buildFeedbackIssueTitle(kind: FeedbackKind, whatHappened: string): string {
  const summary = firstCharacters(stripControlChars(whatHappened).replace(/\s+/g, " ").trim(), 60);
  return `${tr("en", "beta.issue.prefix")} ${kind}: ${summary}`;
}

export function buildFeedbackIssueBody(report: FeedbackReport): string {
  const text = (key: Parameters<typeof tr>[1]) => tr("en", key);
  const metadata = report.metadata;
  const summary = firstCharacters(report.whatHappened, 160);
  const rows = [
    [text("beta.issue.summary"), summary],
    [text("beta.issue.page"), metadata.path],
    [text("beta.issue.locale"), metadata.locale],
    [text("beta.issue.viewport"), metadata.viewport],
    [text("beta.issue.userAgent"), metadata.userAgent],
    [text("beta.issue.betaFeatures"), metadata.activeBetaFeatures.join(", ") || text("beta.issue.notProvided")],
    [text("beta.issue.commit"), metadata.commit],
    ...(metadata.shareUrl ? [[text("beta.issue.shareUrl"), metadata.shareUrl]] : []),
  ];
  const table = [
    `| ${text("beta.issue.metadata")} | Value |`,
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeMarkdownTableCell(label)} | ${escapeMarkdownTableCell(value)} |`),
  ].join("\n");
  return [
    `## ${text("beta.issue.whatHappened")}`,
    report.whatHappened,
    "",
    `## ${text("beta.issue.whatExpected")}`,
    report.whatExpected || text("beta.issue.notProvided"),
    "",
    table,
  ].join("\n");
}
