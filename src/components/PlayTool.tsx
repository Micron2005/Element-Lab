"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PageIntro } from "./shared";
import MoleculeBoard from "./MoleculeBoard";
import Molecule3D from "./Molecule3D";
import { ATOMS, type AtomSymbol } from "@/lib/play/atoms";
import { checkMolecule, prettyFormula, type KnownMolecule, type MolCheck, type MolGraph } from "@/lib/play/molecule";
import { moleculeCard } from "@/lib/play/learn";
import {
  CHAPTERS,
  QUESTS,
  gradeMolecule,
  questById,
  questsIn,
  type Chapter,
  type Grade,
  type MoleculeQuest,
  type Quest,
  type Stars,
} from "@/lib/play/quests";
import { isUnlocked, totalStars } from "@/lib/play/progress";
import {
  awardDaily,
  awardStars,
  useDailyProgress,
  usePlayProgress,
} from "./usePlayProgress";
import { dailyFor, dailyKey, streak } from "@/lib/play/daily";
import { KNOWN_MOLECULES } from "@/lib/play/molecule";
import { compileTemplate, describeTargets, type MixTargets, type QuestTemplate } from "@/lib/play/templates";
import {
  deletePack,
  loadPacks,
  PACKS_CHANGE_EVENT,
  PACKS_KEY,
  savePack,
  sanitizePackContents,
} from "@/lib/play/packs";
import { benchLibrary } from "@/lib/bench/library";
import { REACTIONS } from "@/lib/bench/reactions";
import type { Product } from "@/lib/bench/types";
import { decodeShare, readShareHash } from "@/lib/share";
import LearnCard from "./LearnCard";
import ShareButton from "./ShareButton";
import ShareNotice from "./ShareNotice";
import "./play.css";

const ALL_ATOMS = Object.keys(ATOMS) as AtomSymbol[];
type Tab = Chapter | "free";

function subscribeToPacks(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PACKS_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PACKS_CHANGE_EVENT, onChange);
  };
}

function todaySnapshot(): string {
  return dailyKey();
}

function subscribeToToday() {
  return () => {};
}

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
      <Molecule3D
        graph={molecule.graph}
        label={`${molecule.name}, ${molecule.shape}${molecule.angle ? `, ${molecule.angle}` : ""}`}
      />
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
          {match && <LearnCard card={moleculeCard(match)} />}
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
  const [graph, setGraph] = useState<MolGraph>({ atoms: [], bonds: [] });
  const [show3d, setShow3d] = useState(false);
  const currentCheck = graph.atoms.length >= 2 ? checkMolecule(graph) : null;
  return (
    <section className="play-quest">
      <h2>Free build</h2>
      <p className="play-story">
        Build anything from these atoms. The game checks that every atom has the right number of bonds and names
        the molecule if it knows it.
      </p>
      <MoleculeBoard
        palette={ALL_ATOMS}
        onGraphChange={setGraph}
        onCheck={(nextGraph) => setCheck(checkMolecule(nextGraph))}
        onEdit={() => setCheck(null)}
      />
      <div className="play-3d-toggle">
        <button
          type="button"
          className="button button-secondary"
          aria-expanded={show3d}
          onClick={() => setShow3d((open) => !open)}
        >
          {show3d ? "Hide 3D view" : "3D view"}
        </button>
      </div>
      {show3d && (
        graph.atoms.length < 2 || !currentCheck?.connected ? (
          <p className="play-3d-hint">Connect all atoms to see it in 3D</p>
        ) : (
          <Molecule3D
            graph={graph}
            label={`${currentCheck.match?.name ?? prettyFormula(currentCheck.formula)} molecule`}
          />
        )
      )}
      {check?.match && (
        <div className="play-success" role="status">
          <MoleculeCard molecule={check.match} />
          <LearnCard card={moleculeCard(check.match)} />
        </div>
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

const PRODUCT_CHOICES: { id: Product; label: string }[] = [
  { id: "nothing", label: "No useful solid" },
  { id: "solution", label: "Solution or weak mixture" },
  { id: "gel", label: "Crosslinked gel" },
  { id: "slime", label: "Reversible slime" },
  { id: "fiber", label: "Fiber" },
  { id: "film", label: "Film" },
  { id: "adhesive", label: "Adhesive" },
  { id: "solid", label: "Cured solid" },
  { id: "clumps", label: "Clumps" },
  { id: "dangerous", label: "Dangerous reaction" },
];

function PackQuestEditor({
  quest,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  quest: QuestTemplate;
  index: number;
  canRemove: boolean;
  onChange: (next: QuestTemplate) => void;
  onRemove: () => void;
}) {
  const targets = quest.type === "mix" ? quest.targets : null;
  const updateText = (key: "title" | "story" | "hint", value: string) =>
    onChange({ ...quest, [key]: value } as QuestTemplate);
  const updateMix = (patch: Partial<MixTargets>) => {
    if (quest.type === "mix") onChange({ ...quest, targets: { ...quest.targets, ...patch } });
  };
  const updateNumber = (key: keyof MixTargets, value: string) => {
    const number = value === "" ? undefined : Number(value);
    updateMix({ [key]: number } as Partial<MixTargets>);
  };
  const hasTarget = describeTargets(quest).length > 0;

  return (
    <fieldset className="pack-quest-editor">
      <legend>Quest {index + 1}</legend>
      <div className="pack-editor-row">
        <label className="pack-field">
          <span>Type</span>
          <select
            className="input"
            aria-label={`Quest ${index + 1} type`}
            value={quest.type}
            onChange={(event) => {
              const common = {
                title: "title" in quest ? quest.title : "",
                story: quest.story,
                hint: quest.hint,
              };
              const type = event.target.value;
              onChange(type === "molecule"
                ? { type, moleculeId: KNOWN_MOLECULES[0].id, ...common }
                : type === "mix"
                  ? { type, title: common.title || "Mix quest", story: common.story, hint: common.hint, targets: {} }
                  : { type: "nucleus", title: common.title || "Nucleus quest", story: common.story, hint: common.hint, targets: {} });
            }}
          >
            <option value="molecule">Molecule</option>
            <option value="mix">Mix</option>
            <option value="nucleus">Nucleus</option>
          </select>
        </label>
        {quest.type !== "molecule" && (
          <label className="pack-field">
            <span>Quest title</span>
            <input className="input" maxLength={80} value={quest.title} onChange={(event) => updateText("title", event.target.value)} />
          </label>
        )}
      </div>
      {quest.type === "molecule" && (
        <label className="pack-field">
          <span>Molecule</span>
          <select className="input" value={quest.moleculeId} onChange={(event) => onChange({ ...quest, moleculeId: event.target.value })}>
            {KNOWN_MOLECULES.map((molecule) => <option key={molecule.id} value={molecule.id}>{molecule.name}</option>)}
          </select>
        </label>
      )}
      {quest.type === "molecule" && (
        <label className="pack-field">
          <span>Custom title (optional)</span>
          <input className="input" maxLength={80} value={quest.title ?? ""} onChange={(event) => updateText("title", event.target.value)} />
        </label>
      )}
      <label className="pack-field">
        <span>Story (optional)</span>
        <textarea className="input" maxLength={300} rows={2} value={quest.story ?? ""} onChange={(event) => updateText("story", event.target.value)} />
      </label>
      <label className="pack-field">
        <span>Hint (optional)</span>
        <textarea className="input" maxLength={300} rows={2} value={quest.hint ?? ""} onChange={(event) => updateText("hint", event.target.value)} />
      </label>

      {quest.type === "mix" && (
        <div className="pack-targets">
          <fieldset className="pack-products">
            <legend>Product goals</legend>
            {PRODUCT_CHOICES.map(({ id, label }) => (
              <label key={id} className="pack-check">
                <input
                  type="checkbox"
                  checked={quest.targets.product?.includes(id) ?? false}
                  onChange={(event) => {
                    const current = quest.targets.product ?? [];
                    const product = event.target.checked
                      ? [...current, id]
                      : current.filter((item) => item !== id);
                    updateMix({ product: product.length ? product : undefined });
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="pack-numeric-targets">
            {([
              ["minStrengthMPa", "Minimum strength (MPa)", 0, 5000],
              ["minStretchPct", "Minimum stretch (%)", 0, 5000],
              ["minTack", "Minimum stickiness (0–10)", 0, 10],
              ["maxCostPerKg", "Maximum cost ($/kg)", 0, 10000],
            ] as const).map(([key, label, min, max]) => (
              <label className="pack-field" key={key}>
                <span>{label}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={min}
                  max={max}
                  step="any"
                  value={targets?.[key] ?? ""}
                  onChange={(event) => updateNumber(key, event.target.value)}
                />
              </label>
            ))}
            <label className="pack-field">
              <span>Maximum hazard</span>
              <select
                className="input"
                value={targets?.maxHazard ?? ""}
                onChange={(event) => updateMix({ maxHazard: event.target.value === "" ? undefined : Number(event.target.value) as 0 | 1 | 2 | 3 })}
              >
                <option value="">No hazard target</option>
                <option value="0">0 · none</option>
                <option value="1">1 · low</option>
                <option value="2">2 · moderate</option>
                <option value="3">3 · high</option>
              </select>
            </label>
            <label className="pack-field">
              <span>Must include ingredients</span>
              <select
                className="input pack-multiselect"
                multiple
                value={targets?.mustInclude ?? []}
                onChange={(event) => updateMix({
                  mustInclude: Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                })}
              >
                {benchLibrary.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
              </select>
            </label>
            <label className="pack-field">
              <span>Must happen</span>
              <select
                className="input pack-multiselect"
                multiple
                value={targets?.mustHappen ?? []}
                onChange={(event) => updateMix({
                  mustHappen: Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                })}
              >
                {REACTIONS.map((reaction) => <option key={reaction.id} value={reaction.id}>{reaction.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {quest.type === "nucleus" && (
        <div className="pack-numeric-targets">
          {([
            ["z", "Exact proton count Z", 1, 300],
            ["minZ", "Minimum proton count Z", 1, 300],
            ["minHalfLifeS", "Minimum half-life (seconds)", 0, 1e20],
          ] as const).map(([key, label, min, max]) => (
            <label className="pack-field" key={key}>
              <span>{label}</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={key === "minHalfLifeS" ? "any" : "1"}
                value={quest.targets[key] ?? ""}
                onChange={(event) => {
                  const number = event.target.value === "" ? undefined : Number(event.target.value);
                  onChange({
                    ...quest,
                    targets: { ...quest.targets, [key]: number },
                  });
                }}
              />
            </label>
          ))}
          <label className="pack-check pack-bound-check">
            <input
              type="checkbox"
              checked={quest.targets.bound === true}
              onChange={(event) => onChange({
                ...quest,
                targets: {
                  ...quest.targets,
                  ...(event.target.checked ? { bound: true } : { bound: undefined }),
                },
              })}
            />
            Require a bound nucleus
          </label>
        </div>
      )}
      {!hasTarget && <p className="pack-validation" role="status">Choose at least one goal for this quest.</p>}
      <div className="pack-editor-footer">
        {hasTarget && <span>{describeTargets(quest).join(" · ")}</span>}
        <button className="button button-secondary" type="button" disabled={!canRemove} onClick={onRemove}>Remove quest</button>
      </div>
    </fieldset>
  );
}

export default function PlayTool() {
  const progress = usePlayProgress();
  const dailyProgress = useDailyProgress();
  const today = useSyncExternalStore(subscribeToToday, todaySnapshot, () => "");
  const packsStorage = useSyncExternalStore(
    subscribeToPacks,
    () => localStorage.getItem(PACKS_KEY) ?? "",
    () => "",
  );
  const packs = useMemo(() => loadPacks(packsStorage), [packsStorage]);
  const [tab, setTab] = useState<Tab>("molecules");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState("");
  const [packAuthor, setPackAuthor] = useState("");
  const [packEditorOpen, setPackEditorOpen] = useState(false);
  const [drafts, setDrafts] = useState<QuestTemplate[]>([
    { type: "molecule", moleculeId: KNOWN_MOLECULES[0].id },
  ]);
  const [packMessage, setPackMessage] = useState("");
  const [openedPackId, setOpenedPackId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<{ invalid?: boolean; message?: string } | null>(null);

  useEffect(() => {
    function openPackLink() {
      const encoded = readShareHash(window.location.hash);
      if (encoded === null) return;
      const decoded = decodeShare(encoded);
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      if (!decoded || decoded.payload.kind !== "pack") {
        setShareNotice({ invalid: true });
        return;
      }
      const saved = savePack(decoded.payload.pack);
      if (!saved) {
        setShareNotice({ invalid: true });
        return;
      }
      setOpenedPackId(saved.id);
      setShareNotice({ message: `Quest pack added: ${saved.title}` });
    }
    openPackLink();
    window.addEventListener("hashchange", openPackLink);
    return () => window.removeEventListener("hashchange", openPackLink);
  }, []);

  const active = activeId ? questById(activeId) : undefined;
  const chapterQuests = active ? questsIn(active.chapter) : [];
  const builtInActive = active ? QUESTS.some((quest) => quest.id === active.id) : false;
  const nextIndex = active && builtInActive
    ? chapterQuests.findIndex((quest) => quest.id === active.id) + 1
    : -1;
  const nextQuest = nextIndex >= 0 ? chapterQuests[nextIndex] : undefined;
  const maxStars = QUESTS.length * 3;
  const todayDaily = today ? dailyFor(today) : null;
  const dailyQuest = todayDaily ? compileTemplate(todayDaily.id, todayDaily.template) : null;
  const currentDailyStars = today ? dailyProgress.done[today] ?? 0 : 0;
  const currentStreak = today ? streak(dailyProgress.done, today) : 0;
  const activeDailyKey = active?.id.startsWith("daily:") ? active.id.slice("daily:".length) : null;
  const activeBest = active
    ? activeDailyKey
      ? dailyProgress.done[activeDailyKey] ?? 0
      : progress.stars[active.id] ?? 0
    : 0;
  const normalizedDraft = sanitizePackContents({
    title: packTitle,
    ...(packAuthor.trim() ? { author: packAuthor } : {}),
    quests: drafts,
  });
  const canSave = normalizedDraft !== null;

  function award(questId: string, stars: Stars) {
    if (questId.startsWith("daily:")) awardDaily(questId.slice("daily:".length), stars);
    else awardStars(questId, stars);
  }

  function openTab(next: Tab) {
    setTab(next);
    setActiveId(null);
  }

  function updateDraft(index: number, next: QuestTemplate) {
    setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? next : item));
  }

  function closePackEditor() {
    setPackEditorOpen(false);
    setPackTitle("");
    setPackAuthor("");
    setDrafts([{ type: "molecule", moleculeId: KNOWN_MOLECULES[0].id }]);
    setPackMessage("");
  }

  function saveCurrentPack() {
    if (!normalizedDraft) {
      setPackMessage("Add a title and at least one quest with a goal.");
      return;
    }
    const saved = savePack(normalizedDraft.pack);
    if (!saved) {
      setPackMessage("This pack could not be saved. Check its title and goals.");
      return;
    }
    setOpenedPackId(saved.id);
    closePackEditor();
  }

  function playPackQuest(questId: string, quest: Quest) {
    if (quest.chapter === "molecules") {
      setTab("molecules");
      setActiveId(questId);
    }
  }

  return (
    <div className="play-page">
      <PageIntro
        eyebrow="PLAY & LEARN"
        title="Lab quests"
        description="Side quests with real chemistry and physics. Snap atoms into molecules, mix materials on the Bench, and split atoms. Every answer is checked by the same models the lab uses."
      />
      {shareNotice && (
        <ShareNotice
          invalid={shareNotice.invalid}
          message={shareNotice.message}
          onDismiss={() => setShareNotice(null)}
        />
      )}
      {dailyQuest && todayDaily && (
        <section className="daily-card" aria-labelledby="daily-title">
          <div className="daily-card-heading">
            <div>
              <p className="eyebrow">TODAY · <time dateTime={today}>{today}</time></p>
              <h2 id="daily-title">Daily challenge</h2>
            </div>
            <StarRow stars={currentDailyStars} />
          </div>
          <h3>{dailyQuest.title}</h3>
          {dailyQuest.story && <p className="play-story">{dailyQuest.story}</p>}
          <ul className="daily-goals">
            {describeTargets(todayDaily.template).map((goal) => <li key={goal}>{goal}</li>)}
          </ul>
          <div className="daily-card-footer">
            <p><strong>Stars earned today:</strong> {currentDailyStars} / 3</p>
            <p><strong>Streak:</strong> {currentStreak} days</p>
            {dailyQuest.chapter === "molecules" ? (
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setTab("molecules");
                  setActiveId(dailyQuest.id);
                }}
              >
                Play today&apos;s challenge
              </button>
            ) : (
              <Link
                className="button button-primary"
                href={`${dailyQuest.chapter === "mixing" ? "/bench" : "/elements"}?quest=${encodeURIComponent(dailyQuest.id)}`}
              >
                Play today&apos;s challenge
              </Link>
            )}
          </div>
        </section>
      )}
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
          best={activeBest}
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

      <section className="pack-section" aria-labelledby="packs-title">
        <div className="pack-section-heading">
          <div>
            <p className="eyebrow">SHAREABLE QUESTS</p>
            <h2 id="packs-title">Quest packs</h2>
          </div>
        </div>
        <p className="pack-teacher-note">Teachers: share a pack link with your class. Stars are saved on each student&apos;s device.</p>
        {packs.length === 0 ? (
          <p className="play-blurb">No saved packs yet. Make one below or open a pack link.</p>
        ) : (
          <div className="pack-list">
            {packs.map((pack) => {
              const total = pack.quests.reduce((sum, _quest, index) => sum + (progress.stars[`pack:${pack.id}:${index}`] ?? 0), 0);
              const packId = pack.id;
              return (
                <details
                  className="saved-pack"
                  key={pack.id}
                  open={openedPackId === pack.id}
                  onToggle={(event) => setOpenedPackId(event.currentTarget.open ? pack.id : null)}
                  id={`quest-pack-${pack.id}`}
                >
                  <summary>
                    <span>
                      <strong>{pack.title}</strong>
                      <span className="saved-pack-summary">{pack.author ? `by ${pack.author} · ` : ""}{total} / {pack.quests.length * 3} stars</span>
                    </span>
                    <span aria-hidden="true">⌄</span>
                  </summary>
                  <div className="saved-pack-content">
                    {pack.author && <p className="pack-author">By {pack.author}</p>}
                    <ol className="pack-quest-list">
                      {pack.quests.map((template, index) => {
                        const id = `pack:${packId}:${index}`;
                        const quest = compileTemplate(id, template);
                        const target = quest.chapter === "mixing" ? "/bench" : "/elements";
                        return (
                          <li key={id} className="pack-quest-item">
                            <div>
                              <strong>{quest.title}</strong>
                              <span>{quest.goal}</span>
                              <StarRow stars={progress.stars[id] ?? 0} />
                            </div>
                            {quest.chapter === "molecules" ? (
                              <button className="button button-primary" type="button" onClick={() => playPackQuest(id, quest)}>Play</button>
                            ) : (
                              <Link className="button button-primary" href={`${target}?quest=${encodeURIComponent(id)}`}>Play</Link>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    <div className="saved-pack-actions">
                      <ShareButton
                        label="Share pack"
                        build={() => ({
                          v: 1,
                          kind: "pack",
                          pack: { title: pack.title, ...(pack.author ? { author: pack.author } : {}), quests: pack.quests },
                        })}
                      />
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => {
                          deletePack(pack.id);
                          setOpenedPackId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
        <button
          className="button button-secondary pack-editor-toggle"
          type="button"
          aria-controls="pack-editor"
          aria-expanded={packEditorOpen}
          onClick={() => {
            if (packEditorOpen) setPackEditorOpen(false);
            else {
              setPackMessage("");
              setPackEditorOpen(true);
            }
          }}
        >
          {packEditorOpen ? "− Hide editor" : "+ Make a pack"}
        </button>
        <div
          className="pack-maker"
          id="pack-editor"
          role="group"
          aria-labelledby="make-pack-title"
          hidden={!packEditorOpen}
        >
          <div className="pack-section-heading">
            <div>
              <p className="eyebrow">BUILD YOUR OWN</p>
              <h3 id="make-pack-title">Make a pack</h3>
            </div>
          </div>
          <div className="pack-editor-row">
            <label className="pack-field">
              <span>Pack title</span>
              <input className="input" maxLength={80} value={packTitle} onChange={(event) => setPackTitle(event.target.value)} />
            </label>
            <label className="pack-field">
              <span>Author (optional)</span>
              <input className="input" maxLength={40} value={packAuthor} onChange={(event) => setPackAuthor(event.target.value)} />
            </label>
          </div>
          <div className="pack-editor-list">
            {drafts.map((draft, index) => (
              <PackQuestEditor
                key={index}
                index={index}
                quest={draft}
                canRemove={drafts.length > 1}
                onChange={(next) => updateDraft(index, next)}
                onRemove={() => setDrafts((current) => current.filter((_item, itemIndex) => itemIndex !== index))}
              />
            ))}
          </div>
          <div className="pack-editor-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={drafts.length >= 10}
              onClick={() => setDrafts((current) => [
                ...current,
                { type: "molecule", moleculeId: KNOWN_MOLECULES[0].id },
              ])}
            >
              Add quest ({drafts.length}/10)
            </button>
            <button className="button button-secondary" type="button" onClick={closePackEditor}>Cancel</button>
            <button className="button button-primary" type="button" disabled={!canSave} onClick={saveCurrentPack}>Save pack</button>
          </div>
          {packMessage && <p className="pack-status" role="status">{packMessage}</p>}
        </div>
      </section>
    </div>
  );
}
