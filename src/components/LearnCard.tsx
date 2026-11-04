"use client";

import { useRouter } from "next/navigation";
import type { LearnCard as LearnCardData } from "@/lib/play/learn";
import { useT } from "./LocaleProvider";
import { useBeta } from "./BetaProvider";
import { useGradeLevel } from "./useGradeLevel";

const HANDOFF_KEY = "elementlab.assistant.handoff";

export default function LearnCard({ card }: { card: LearnCardData }) {
  const router = useRouter();
  const { t } = useT();
  const level = useGradeLevel();
  const depthEnabled = useBeta().isOn("grade-levels");
  const showMore = depthEnabled && level === "middle";
  const showDeeper = depthEnabled && level === "college";

  function askLabPartner() {
    localStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        title: card.title,
        context: card.context,
        prompt: card.askPrompt,
        at: Date.now(),
      }),
    );
    router.push("/assistant");
  }

  return (
    <section className="play-learn-card" aria-label={t("ui.whatJustMade")}>
      <p className="eyebrow">{t("ui.whatJustMade")}</p>
      <h3>{card.title}</h3>
      {showMore && <p>{card.simple}</p>}
      {showMore ? (
        <details>
          <summary>{t("play.level.showMore")}</summary>
          <div className="play-learn-sections">{card.sections.map((section) => (
            <div key={section.heading}><h4>{t(section.heading)}</h4><p>{section.body}</p></div>
          ))}</div>
          <div className="play-learn-uses">
            <h4>{t("ui.usedFor")}</h4>
            <ul>{card.usedFor.map((use) => <li key={use}>{use}</li>)}</ul>
          </div>
        </details>
      ) : (
        <>
          <div className="play-learn-sections">{card.sections.map((section) => (
            <div key={section.heading}><h4>{t(section.heading)}</h4><p>{section.body}</p></div>
          ))}</div>
          <div className="play-learn-uses">
            <h4>{t("ui.usedFor")}</h4>
            <ul>{card.usedFor.map((use) => <li key={use}>{use}</li>)}</ul>
          </div>
        </>
      )}
      {showDeeper && <details><summary>{t("play.level.goDeeper")}</summary><p>{card.deeper}</p></details>}
      <button
        type="button"
        className="button button-secondary play-learn-ask"
        onClick={askLabPartner}
      >
        {t("ui.askPartner")}
      </button>
    </section>
  );
}
