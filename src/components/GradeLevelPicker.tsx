"use client";

import { saveGradeLevel, type GradeLevel } from "@/lib/play/levels";
import { useT } from "./LocaleProvider";
import { useGradeLevel } from "./useGradeLevel";

export default function GradeLevelPicker() {
  const { t } = useT();
  const level = useGradeLevel();
  const labels: Record<GradeLevel, string> = {
    middle: t("play.level.middle"),
    high: t("play.level.high"),
    college: t("play.level.college"),
  };

  return (
    <fieldset className="grade-level-picker">
      <legend>{t("play.level.label")}</legend>
      <div role="group" aria-label={t("play.level.label")}>
        {(["middle", "high", "college"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={level === option ? "is-active" : ""}
            aria-pressed={level === option}
            onClick={() => saveGradeLevel(option)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
