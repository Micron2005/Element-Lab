"use client";

import Link from "next/link";
import { useState } from "react";
import { PageIntro } from "./shared";
import MoleculeBoard, { MoleculeDrawing } from "./MoleculeBoard";
import { ATOMS, type AtomSymbol } from "@/lib/play/atoms";
import { checkMolecule, prettyFormula, type KnownMolecule, type MolCheck, type MolGraph } from "@/lib/play/molecule";
import {
  CHAPTERS,
  QUESTS,
  gradeMolecule,
  questsIn,
  type Chapter,
  type Grade,
  type MoleculeQuest,
  type Quest,
  type Stars,
} from "@/lib/play/quests";
import { isUnlocked, totalStars } from "@/lib/play/progress";
import { awardStars, usePlayProgress } from "./usePlayProgress";
import "./play.css";

const ALL_ATOMS = Object.keys(ATOMS) as AtomSymbol[];
type Tab = Chapter | "free";

export function StarRow({ stars }: { stars: number }) {
  return (
    <span className="play-stars" aria-label={`${stars} of 3 stars`}>
      {[0, 1, 2].map((index) => (
        <span key={index} className={index < stars ? "on" : ""} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

function MoleculeCard({ molecule }: { molecule: KnownMolecule }) {
  return (
    <div className="play-molecule-card">
      <div className="play-molecule-shape">
        <MoleculeDrawing graph={molecule.graph} label={`${molecule.name} structure`} />
      </div>
      <div className="play-molecule-info">
        <h3>
          {molecule.name} <span className="play-formula">{prettyFormula(molecule.formula)}</span>
        </h3>
        <p><strong>Shape:</strong> {molecule.shape}{molecule.angle ? ` · ${molecule.angle}` : ""}</p>
        <p><strong>Used for:</strong> {molecule.uses}</p>
        <p>{molecule.fact}</p>
        {molecule.caution && <p className="play-caution">Caution: {molecule.caution}</p>}
      </div>
    </div>
  );
}

function MoleculeQuestPlay({
  quest,
  onAward,
  onNext,
}: {
  quest: MoleculeQuest;
  onAward: (stars: Stars) => void;
  onNext?: () => void;
}) {
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [match, setMatch] = useState<KnownMolecule | undefined>();

  function check(graph: MolGraph) {
    const next = gradeMolecule(quest, graph, hintsUsed);
    setGrade(next);
    setMatch(checkMolecule(graph).match);
    if (next.stars > 0) onAward(next.stars);
  }

  return (
    <>
      <MoleculeBoard palette={quest.palette} onCheck={check} onEdit={() => setGrade(null)} />
      <div className="play-hint-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            if (!showHint) setHintsUsed((used) => Math.max(used, 1));
            setShowHint((open) => !open);
          }}
        >
          {showHint ? "Hide hint" : hintsUsed ? "Show hint" : "Hint (costs a star)"}
        </button>
      </div>
      {showHint && <p className="play-hint">{quest.hint}</p>}
      {grade && grade.stars > 0 && (
        <div className="play-success" role="status">
          <p className="play-result-title"><StarRow stars={grade.stars} /> Quest complete!</p>
          <ul>{grade.feedback.map((line) => <li key={line}>{line}</li>)}</ul>
          {match && <MoleculeCard molecule={match} />}
          <p className="play-learn">{quest.learn}</p>
          {onNext && <button type="button" className="button button-primary" onClick={onNext}>Next quest →</button>}
        </div>
      )}
      {grade && grade.stars === 0 && (
        <div className="play-fail" role="status">
          <p className="play-result-title">Not quite yet</p>
          <ul>{grade.feedback.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function FreeBuild() {
  const [check, setCheck] = useState<MolCheck | null>(null);
  return (
    <section className="play-quest">
      <h2>Free build</h2>
      <p className="play-story">
        Build anything from these atoms. The game checks that every atom has the right number of bonds and names
        the molecule if it knows it.
      </p>
      <MoleculeBoard palette={ALL_ATOMS} onCheck={(graph) => setCheck(checkMolecule(graph))} onEdit={() => setCheck(null)} />
      {check?.match && (
        <div className="play-success" role="status"><MoleculeCard molecule={check.match} /></div>
      )}
      {check && !check.match && check.complete && (
        <div className="play-success" role="status">
          <p className="play-result-title">Valid bonding: {prettyFormula(check.formula)}</p>
          <p>
            Every atom has all its bonds, so the bonding rules allow it. Whether it&apos;s stable in real life is
            another question, and it isn&apos;t in this game&apos;s list yet. Try looking it up in{" "}
            <Link href="/chemicals">Chemicals</Link>.
          </p>
        </div>
      )}
      {check && !check.complete && (
        <div className="play-fail" role="status">
          <p className="play-result-title">Not a finished molecule yet</p>
          <ul>{check.problems.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function QuestView({
  quest,
  best,
  onBack,
  onAward,
  onNext,
}: {
  quest: Quest;
  best: number;
  onBack: () => void;
  onAward: (stars: Stars) => void;
  onNext?: () => void;
}) {
  const chapter = CHAPTERS.find((item) => item.id === quest.chapter);
  const external = quest.chapter === "mixing" ? "/bench" : "/elements";
  return (
    <section className="play-quest">
      <button type="button" className="button button-secondary play-back" onClick={onBack}>← All quests</button>
      <p className="eyebrow">{chapter?.title}</p>
      <h2>{quest.title}</h2>
      <p className="play-story">{quest.story}</p>
      <p className="play-goal"><strong>Goal:</strong> {quest.goal}</p>
      <ol className="play-star-goals">
        {quest.starGoals.map((goal, index) => (
          <li key={goal} className={best > index ? "on" : ""}>
            <span aria-hidden="true">★</span> {goal}
          </li>
        ))}
      </ol>
      {quest.chapter === "molecules" ? (
        <MoleculeQuestPlay key={quest.id} quest={quest} onAward={onAward} onNext={onNext} />
      ) : (
        <div className="play-launch">
          <p>
            {quest.chapter === "mixing"
              ? "This quest runs on the real Experiment Bench. Build your mix, press Run, and you'll be graded there."
              : "This quest runs in the Element explorer. Move the proton and neutron sliders and you'll be graded as you go."}
          </p>
          <Link className="button button-primary" href={`${external}?quest=${quest.id}`}>
            {quest.chapter === "mixing" ? "Start at the Bench" : "Start in Elements"}
          </Link>
        </div>
      )}
    </section>
  );
}

export default function PlayTool() {
  const progress = usePlayProgress();
  const [tab, setTab] = useState<Tab>("molecules");
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = activeId ? QUESTS.find((quest) => quest.id === activeId) : undefined;
  const chapterQuests = active ? questsIn(active.chapter) : [];
  const nextQuest = active ? chapterQuests[chapterQuests.findIndex((quest) => quest.id === active.id) + 1] : undefined;
  const maxStars = QUESTS.length * 3;

  function award(questId: string, stars: Stars) {
    awardStars(questId, stars);
  }

  function openTab(next: Tab) {
    setTab(next);
    setActiveId(null);
  }

  return (
    <div className="play-page">
      <PageIntro
        eyebrow="PLAY & LEARN"
        title="Lab quests"
        description="Side quests with real chemistry and physics. Snap atoms into molecules, mix materials on the Bench, and split atoms. Every answer is checked by the same models the lab uses."
      />
      <div className="play-score">
        <StarRow stars={3} />
        <span><strong>{totalStars(progress)}</strong> / {maxStars} stars</span>
      </div>
      <div className="play-tabs" role="tablist" aria-label="Chapters">
        {CHAPTERS.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            role="tab"
            aria-selected={tab === chapter.id}
            className={tab === chapter.id ? "is-active" : ""}
            onClick={() => openTab(chapter.id)}
          >
            {chapter.title}
          </button>
        ))}
        <button type="button" role="tab" aria-selected={tab === "free"} className={tab === "free" ? "is-active" : ""} onClick={() => openTab("free")}>
          Free build
        </button>
      </div>

      {tab === "free" && <FreeBuild />}

      {tab !== "free" && active && (
        <QuestView
          quest={active}
          best={progress.stars[active.id] ?? 0}
          onBack={() => setActiveId(null)}
          onAward={(stars) => award(active.id, stars)}
          onNext={nextQuest ? () => setActiveId(nextQuest.id) : undefined}
        />
      )}

      {tab !== "free" && !active && (
        <>
          <p className="play-blurb">{CHAPTERS.find((chapter) => chapter.id === tab)?.blurb}</p>
          <ol className="play-quest-list">
            {questsIn(tab).map((quest, index) => {
              const unlocked = isUnlocked(quest.id, progress);
              return (
                <li key={quest.id}>
                  <button type="button" className="play-quest-item" disabled={!unlocked} onClick={() => setActiveId(quest.id)}>
                    <span className="play-quest-num">{index + 1}</span>
                    <span className="play-quest-text">
                      <strong>{quest.title}</strong>
                      <span>{unlocked ? quest.goal : "Earn a star on the previous quest to unlock"}</span>
                    </span>
                    {unlocked ? <StarRow stars={progress.stars[quest.id] ?? 0} /> : <span className="play-lock">Locked</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
