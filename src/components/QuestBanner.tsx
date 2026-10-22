"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { questById, type Grade } from "@/lib/play/quests";
import type { Experiment, RunResult } from "@/lib/bench/types";
import { StarRow } from "./PlayTool";
import { awardStars, usePlayProgress, useQuestParam } from "./usePlayProgress";
import "./play.css";

type Props =
  | { mode: "mix"; experiment: Experiment | null; result: RunResult | null }
  | { mode: "atom"; z: number; n: number };

export default function QuestBanner(props: Props) {
  const questId = useQuestParam();
  const progress = usePlayProgress();
  const best = questId ? progress.stars[questId] ?? 0 : 0;
  const [showHint, setShowHint] = useState(false);
  const [startNucleus] = useState(() => (props.mode === "atom" ? `${props.z}-${props.n}` : ""));

  const quest = questId ? questById(questId) : undefined;
  const fits = quest && ((props.mode === "mix" && quest.chapter === "mixing") || (props.mode === "atom" && quest.chapter === "atoms"));

  const mixExperiment = props.mode === "mix" ? props.experiment : null;
  const mixResult = props.mode === "mix" ? props.result : null;
  const z = props.mode === "atom" ? props.z : 0;
  const n = props.mode === "atom" ? props.n : 0;

  const grade: Grade | null = useMemo(() => {
    if (!quest || !fits) return null;
    if (quest.chapter === "mixing") return mixExperiment && mixResult ? quest.grade(mixExperiment, mixResult) : null;
    if (quest.chapter === "atoms") return `${z}-${n}` === startNucleus ? null : quest.grade(z, n);
    return null;
  }, [quest, fits, mixExperiment, mixResult, z, n, startNucleus]);

  useEffect(() => {
    if (quest && grade && grade.stars > best) {
      awardStars(quest.id, grade.stars);
    }
  }, [quest, grade, best]);

  if (!quest || !fits) return null;
  const stars = grade?.stars ?? 0;

  return (
    <section className="quest-banner" aria-label="Quest">
      <div className="quest-banner-top">
        <span className="eyebrow">QUEST</span>
        <Link href="/play">All quests</Link>
      </div>
      <h2>{quest.title}</h2>
      <p className="play-story">{quest.story}</p>
      <p className="play-goal"><strong>Goal:</strong> {quest.goal}</p>
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
            <StarRow stars={stars} /> {stars === 3 ? "Perfect!" : stars > 0 ? "Quest complete" : "Not yet"}
          </p>
          <ul>{grade.feedback.map((line) => <li key={line}>{line}</li>)}</ul>
          {stars > 0 && <p className="play-learn">{quest.learn}</p>}
        </div>
      ) : (
        <p className="quest-wait">
          {props.mode === "mix"
            ? "Build your mix below and press Run to be graded."
            : "Change the protons or neutrons below to be graded."}
        </p>
      )}
      <div className="quest-actions">
        <button type="button" className="button button-secondary" onClick={() => setShowHint((open) => !open)}>
          {showHint ? "Hide hint" : "Hint"}
        </button>
        {best > 0 && <Link className="button button-secondary" href="/play">Back to quests · best <StarRow stars={best} /></Link>}
      </div>
      {showHint && <p className="play-hint">{quest.hint}</p>}
    </section>
  );
}
