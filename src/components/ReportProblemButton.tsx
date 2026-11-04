"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { buildFeedbackIssueBody, sanitizeFeedbackInput, type FeedbackKind, type FeedbackReport } from "@/lib/feedback";
import { buildCurrentShareUrl } from "@/lib/share";
import { useBeta } from "./BetaProvider";
import { useT } from "./LocaleProvider";

const kindOptions = [
  ["Bug", "beta.report.kind.bug"],
  ["Idea", "beta.report.kind.idea"],
  ["Confusing", "beta.report.kind.confusing"],
] as const;

type FeedbackState = "idle" | "not-configured" | "success" | "error" | "copied" | "copy-failed";

export default function ReportProblemButton() {
  const { locale, t } = useT();
  const { activeFeatures, commit } = useBeta();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const happenedRef = useRef<HTMLTextAreaElement>(null);
  const wasOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [whatHappened, setWhatHappened] = useState("");
  const [whatExpected, setWhatExpected] = useState("");
  const [kind, setKind] = useState<FeedbackKind>("Bug");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [includeExperiment, setIncludeExperiment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<FeedbackState>("idle");
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [issueUrl, setIssueUrl] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      wasOpenRef.current = true;
      if (!dialog.open) dialog.showModal();
      happenedRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      if (dialog.open) dialog.close();
      triggerRef.current?.focus();
    }
  }, [open]);

  function showDialog() {
    const currentShare = buildCurrentShareUrl(
      window.location.origin,
      `${window.location.pathname}${window.location.search}`,
      window.location.hash,
    );
    setShareUrl(currentShare);
    setIncludeExperiment(Boolean(currentShare));
    setState("idle");
    setReport(null);
    setIssueUrl("");
    setOpen(true);
  }

  function createReport(): FeedbackReport | null {
    return sanitizeFeedbackInput({
      kind,
      whatHappened,
      whatExpected,
      metadata: {
        path: `${window.location.pathname}${window.location.search}`,
        locale,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
        userAgent: navigator.userAgent,
        activeBetaFeatures: activeFeatures,
        commit,
        ...(includeExperiment && shareUrl ? { shareUrl } : {}),
      },
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextReport = createReport();
    if (!nextReport) return;
    setReport(nextReport);
    setSubmitting(true);
    setState("idle");
    try {
      const response = await fetch(new URL("/api/feedback", window.location.origin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextReport),
      });
      const result = await response.json() as { ok?: boolean; reason?: string; url?: string };
      if (response.status === 503 && result.reason === "not-configured") {
        setState("not-configured");
      } else if (response.ok && result.ok && typeof result.url === "string") {
        setIssueUrl(result.url);
        setState("success");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyReport() {
    const currentReport = report ?? createReport();
    if (!currentReport) return;
    setReport(currentReport);
    try {
      await navigator.clipboard.writeText(buildFeedbackIssueBody(currentReport));
      setState("copied");
    } catch {
      setState("copy-failed");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="button button-primary beta-report-trigger"
        aria-label={t("beta.report.button")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t("beta.report.button")}
        onClick={showDialog}
      >
        <span className="beta-report-trigger-label">{t("beta.report.button")}</span>
        <span className="beta-report-trigger-icon" aria-hidden="true">!</span>
      </button>
      <dialog
        ref={dialogRef}
        className="beta-dialog"
        aria-labelledby="beta-report-title"
        aria-modal="true"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <form className="beta-dialog-form" onSubmit={(event) => void submit(event)}>
          <header className="beta-dialog-heading">
            <h2 id="beta-report-title">{t("beta.report.title")}</h2>
            <button type="button" className="icon-button" aria-label={t("beta.report.close")} onClick={() => setOpen(false)}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <label className="beta-report-field" htmlFor="beta-report-happened">
            <span>{t("beta.report.whatHappened")}</span>
            <textarea
              ref={happenedRef}
              id="beta-report-happened"
              className="textarea"
              required
              maxLength={4000}
              rows={5}
              value={whatHappened}
              onChange={(event) => setWhatHappened(event.target.value)}
            />
          </label>
          <label className="beta-report-field" htmlFor="beta-report-expected">
            <span>{t("beta.report.whatExpected")}</span>
            <textarea
              id="beta-report-expected"
              className="textarea"
              maxLength={4000}
              rows={3}
              value={whatExpected}
              onChange={(event) => setWhatExpected(event.target.value)}
            />
          </label>
          <label className="beta-report-field" htmlFor="beta-report-kind">
            <span>{t("beta.report.kind")}</span>
            <select id="beta-report-kind" className="select" value={kind} onChange={(event) => setKind(event.target.value as FeedbackKind)}>
              {kindOptions.map(([value, key]) => <option value={value} key={value}>{t(key)}</option>)}
            </select>
          </label>
          <label className="beta-report-checkbox">
            <input
              type="checkbox"
              checked={includeExperiment}
              disabled={!shareUrl}
              onChange={(event) => setIncludeExperiment(event.target.checked)}
            />
            <span>{t("beta.report.includeExperiment")}</span>
          </label>
          {!shareUrl && <p className="small muted">{t("beta.report.noExperiment")}</p>}
          <div className="beta-dialog-actions">
            <button type="button" className="button button-secondary" onClick={() => setOpen(false)}>{t("beta.report.cancel")}</button>
            <button type="submit" className="button button-primary" disabled={submitting || !whatHappened.trim()}>
              {submitting ? t("beta.report.sending") : t("beta.report.submit")}
            </button>
          </div>
          {state === "not-configured" && (
            <div className="beta-report-result" role="status">
              <p>{t("beta.report.notConfigured")}</p>
              <button type="button" className="button button-secondary" onClick={() => void copyReport()}>{t("beta.report.copy")}</button>
            </div>
          )}
          {state === "success" && (
            <div className="beta-report-result" role="status">
              <p>{t("beta.report.success")}</p>
              {issueUrl && <a href={issueUrl} target="_blank" rel="noreferrer">{t("beta.report.issueLink")}</a>}
            </div>
          )}
          {state === "error" && <p className="beta-report-result" role="alert">{t("beta.report.error")}</p>}
          {state === "copied" && <p className="beta-report-result" role="status">{t("beta.report.copied")}</p>}
          {state === "copy-failed" && <p className="beta-report-result" role="alert">{t("beta.report.copyFailed")}</p>}
        </form>
      </dialog>
    </>
  );
}
