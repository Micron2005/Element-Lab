"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { questById, type Grade } from "@/lib/play/quests";
import type { Experiment, RunResult } from "@/lib/bench/types";
import { atomCard, mixCard } from "@/lib/play/learn";
import { StarRow } from "./PlayTool";
import LearnCard from "./LearnCard";
import { awardDaily, awardStars, useDailyProgress, usePlayProgress, useQuestParam } from "./usePlayProgress";
import { useT } from "./LocaleProvider";
import "./play.css";

type Props =
  | { mode: "mix"; experiment: Experiment | null; result: RunResult | null }
  | { mode: "atom"; z: number; n: number };

export default function QuestBanner(props: Props) {
  const { locale, t } = useT();
  const questId = useQuestParam();
  const progress = usePlayProgress();
  const dailyProgress = useDailyProgress();
  const dayKey = questId?.startsWith("daily:") ? questId.slice("daily:".length) : null;
  const best = dayKey
    ? dailyProgress.done[dayKey] ?? 0
    : questId
      ? progress.stars[questId] ?? 0
      : 0;
  const [showHint, setShowHint] = useState(false);
  const [startNucleus] = useState(() => (props.mode === "atom" ? `${props.z}-${props.n}` : ""));

  const quest = questId ? questById(questId, locale) : undefined;
  const fits = quest && ((props.mode === "mix" && quest.chapter === "mixing") || (props.mode === "atom" && quest.chapter === "atoms"));

  const mixExperiment = props.mode === "mix" ? props.experiment : null;
  const mixResult = props.mode === "mix" ? props.result : null;
  const z = props.mode === "atom" ? props.z : 0;
  const n = props.mode === "atom" ? props.n : 0;

  const grade: Grade | null = useMemo(() => {
    if (!quest || !fits) return null;
    if (quest.chapter === "mixing") return mixExperiment && mixResult ? quest.grade(mixExperiment, mixResult, locale) : null;
    if (quest.chapter === "atoms") return `${z}-${n}` === startNucleus ? null : quest.grade(z, n, locale);
    return null;
  }, [quest, fits, mixExperiment, mixResult, z, n, startNucleus, locale]);
  const stars = grade?.stars ?? 0;
  const learnCard = useMemo(() => {
    if (stars === 0 || !quest || !fits) return null;
    if (quest.chapter === "mixing" && props.mode === "mix" && mixExperiment && mixResult) {
      return mixCard(quest, mixExperiment, mixResult, locale);
    }
    if (quest.chapter === "atoms" && props.mode === "atom") {
      return atomCard(quest, z, n, locale);
    }
    return null;
  }, [stars, quest, fits, props.mode, mixExperiment, mixResult, z, n, locale]);

  useEffect(() => {
    if (quest && grade && grade.stars > best) {
      if (dayKey) awardDaily(dayKey, grade.stars);
      else awardStars(quest.id, grade.stars);
    }
  }, [quest, grade, best, dayKey]);

  if (!quest || !fits) return null;

  return (
    <section className="quest-banner" aria-label={t("play.banner.quest")}>
      <div className="quest-banner-top">
        <span className="eyebrow">{t("play.banner.quest")}</span>
        <Link href="/play">{t("play.banner.allQuests")}</Link>
      </div>
      <h2>{quest.title}</h2>
      <p className="play-story">{quest.story}</p>
      <p className="play-goal"><strong>{t("play.banner.goal")}</strong> {quest.goal}</p>
      <ol className="play-star-goals">
        {quest.starGoals.map((goal, index) => (
          <li key={goal} className={stars > index ? "on" : ""}>
            <span aria-hidden="true">★</span> {goal}
          </li>
        ))}
      </ol>
      {grade ? (
        <div className={stars > 0 ? "play-success" : "play-fail"} role="status">
          <p className="play-result-title">
            <StarRow stars={stars} /> {stars === 3 ? t("play.banner.perfect") : stars > 0 ? t("play.banner.complete") : t("play.banner.notYet")}
          </p>
          <ul>{grade.feedback.map((line) => <li key={line}>{line}</li>)}</ul>
          {stars > 0 && <p className="play-learn">{quest.learn}</p>}
          {stars > 0 && learnCard && <LearnCard card={learnCard} />}
        </div>
      ) : (
        <p className="quest-wait">
          {props.mode === "mix"
            ? t("play.banner.mixWait")
            : t("play.banner.atomWait")}
        </p>
      )}
      <div className="quest-actions">
        <button type="button" className="button button-secondary" onClick={() => setShowHint((open) => !open)}>
          {showHint ? t("play.banner.hideHint") : t("play.banner.hint")}
        </button>
        {best > 0 && <Link className="button button-secondary" href="/play">{t("play.banner.backBest", { stars: best })} <StarRow stars={best} /></Link>}
      </div>
      {showHint && <p className="play-hint">{quest.hint}</p>}
    </section>
  );
}
