"use client";

import { useEffect, useState } from "react";
import { reportFileName, type LabReportDoc, type ReportExtra } from "@/lib/labReport";
import { useT } from "./LocaleProvider";

export default function LabReportButton({
  build,
  disabledReason,
}: {
  build: (extra: ReportExtra) => LabReportDoc | null;
  disabledReason?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        setStudent(window.localStorage.getItem("elementlab.report.name") ?? "");
      } catch {
        setStudent("");
      }
      setNameReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!nameReady) return;
    try {
      window.localStorage.setItem("elementlab.report.name", student);
    } catch {
      return;
    }
  }, [nameReady, student]);

  async function download() {
    setStatus("");
    try {
      const doc = build({
        ...(student.trim() ? { student: student.trim() } : {}),
        ...(question.trim() ? { question: question.trim() } : {}),
      });
      if (!doc) throw new Error(t("report.notReady"));
      const { renderLabReportBlob } = await import("@/lib/labReportPdf");
      const blob = await renderLabReportBlob(doc);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = reportFileName(doc);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus(t("report.downloaded"));
    } catch {
      setStatus(t("report.failed"));
    }
  }

  return (
    <div className="lab-report-widget" style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <button
        className="button button-secondary"
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason}
        aria-label={disabledReason ?? t("ui.labReportPdf")}
        style={{ minHeight: 44 }}
        onClick={() => setOpen((value) => !value)}
      >
        {disabledReason ?? t("ui.labReportPdf")}
      </button>
      {open && !disabledReason && (
        <div className="lab-report-form" style={{ display: "grid", gap: 10, padding: 12, border: "1px solid #334447", borderRadius: 8 }}>
          <label className="lab-report-field" style={{ display: "grid", gap: 5 }}>
            <span>{t("report.nameOptional")}</span>
            <input
              className="input"
              type="text"
              value={student}
              style={{ fontSize: 16 }}
              onChange={(event) => setStudent(event.target.value)}
            />
            <span className="small muted">{t("report.savedLocal")}</span>
          </label>
          <label className="lab-report-field" style={{ display: "grid", gap: 5 }}>
            <span>{t("report.questionOptional")}</span>
            <input
              className="input"
              type="text"
              value={question}
              style={{ fontSize: 16 }}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <button className="button button-primary" type="button" style={{ minHeight: 44 }} onClick={() => void download()}>
            {t("report.downloadPdf")}
          </button>
          {status && <span role="status" aria-live="polite">{status}</span>}
        </div>
      )}
      {status && !open && <span role="status" aria-live="polite">{status}</span>}
    </div>
  );
}
