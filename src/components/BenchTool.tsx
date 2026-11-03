"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { fmtTime, hazardWord } from "@/lib/formula";
import { DEFAULT_CONDITIONS, effectivePH, waterBoilingPointC } from "@/lib/bench/conditions";
import { compareRuns, isNotSolid } from "@/lib/bench/compare";
import { CUSTOM_PREFIX, newCustomId } from "@/lib/bench/custom";
import { allBenchIngredients, benchById } from "@/lib/bench/library";
import { findBestMixesAsync } from "@/lib/bench/optimize";
import { benchPresets } from "@/lib/bench/presets";
import { simulate } from "@/lib/bench/simulate";
import { tr, trText } from "@/lib/i18n";
import { buildMixScene } from "@/lib/bench/scene";
import CustomIngredientForm from "./CustomIngredientForm";
import MixViewer from "./MixViewer";
import RangeNumberField from "./RangeNumberField";
import BenchTests from "./BenchTests";
import { useCustomIngredients } from "./useCustomIngredients";
import ShareButton from "./ShareButton";
import ShareNotice from "./ShareNotice";
import LabReportButton from "./LabReportButton";
import { benchReport, type TestSummary } from "@/lib/labReport";
import {
  decodeShare,
  isBenchTestId,
  readShareHash,
  shareUrl,
  type BenchTestId,
} from "@/lib/share";
import type {
  BenchIngredient,
  Candidate,
  Category,
  Conditions,
  Experiment,
  Goal,
  Part,
  RunResult,
} from "@/lib/bench/types";
import "./bench.css";
import QuestBanner from "./QuestBanner";
import { Term } from "./Term";
import { useT } from "./LocaleProvider";

type IngredientFilter =
  | "All"
  | "Elements"
  | "Salts"
  | "Proteins"
  | "Enzymes"
  | "Polymers"
  | "Solvents"
  | "Acids/Bases"
  | "Additives"
  | "Mine";

interface NotebookEntry {
  id: string;
  name: string;
  createdAt: string;
  experiment: Experiment;
  result: RunResult;
}

interface BenchShareUndo {
  experiment: Experiment;
  selectedPreset: string;
  result: RunResult | null;
  lastRunExperiment: Experiment | null;
  testId: string | null;
}

const CURRENT_KEY = "elementlab.bench.current";
const NOTEBOOK_KEY = "elementlab.notebook";
const filterOptions: IngredientFilter[] = [
  "All",
  "Elements",
  "Salts",
  "Proteins",
  "Enzymes",
  "Polymers",
  "Solvents",
  "Acids/Bases",
  "Additives",
  "Mine",
];

function cloneExperiment(experiment: Experiment): Experiment {
  return {
    parts: experiment.parts.map((part) => ({ ...part })),
    conditions: { ...experiment.conditions },
  };
}

function experimentsEqual(left: Experiment, right: Experiment): boolean {
  const conditionKeys: (keyof Conditions)[] = [
    "tempC",
    "pressureKPa",
    "atmosphere",
    "humidityPct",
    "mixRpm",
    "mixMinutes",
    "cureMinutes",
    "forming",
    "bathId",
  ];
  return (
    left.parts.length === right.parts.length &&
    left.parts.every(
      (part, index) =>
        part.id === right.parts[index].id && part.pct === right.parts[index].pct,
    ) &&
    conditionKeys.every((key) => left.conditions[key] === right.conditions[key])
  );
}

function ingredientMatchesFilter(
  ingredient: BenchIngredient,
  filter: IngredientFilter,
): boolean {
  if (filter === "All") return true;
  if (filter === "Mine") return ingredient.id.startsWith(CUSTOM_PREFIX);
  const { category } = ingredient;
  if (filter === "Elements") return category === "element" || category === "filler";
  const map: Record<Exclude<IngredientFilter, "All" | "Elements" | "Mine">, Category> = {
    Salts: "salt",
    Proteins: "protein",
    Enzymes: "enzyme",
    Polymers: "polymer",
    Solvents: "solvent",
    "Acids/Bases": "acid-base",
    Additives: "additive",
  };
  return category === map[filter];
}

function normalizeMix(parts: Part[]): Part[] {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.pct), 0);
  if (!parts.length || total <= 0) return parts;
  const normalized = parts.map((part) => ({
    ...part,
    pct: Math.round((Math.max(0, part.pct) / total) * 10000) / 100,
  }));
  const remainder =
    100 -
    normalized
      .slice(0, -1)
      .reduce((sum, part) => sum + part.pct, 0);
  normalized[normalized.length - 1].pct = Math.round(remainder * 100) / 100;
  return normalized;
}

function hazardLabel(value: number): string {
  return hazardWord(value as 0 | 1 | 2 | 3);
}

function showTime(seconds: number, locale: "en" | "es" = "en"): string {
  return seconds > 0 ? fmtTime(seconds, locale) : tr(locale, "bench.notSet");
}

function formatMPa(value: number): string {
  return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
}

function formatPercent(value: number): string {
  return Math.round(value).toString();
}

function formatTack(value: number): string {
  return value.toFixed(1);
}

function formatToughness(value: number): string {
  return Number(value.toPrecision(2)).toString();
}

function formatCost(value: number): string {
  return value < 10 ? value.toFixed(2) : Math.round(value).toString();
}

function formattedMechanicalValue(
  result: RunResult,
  value: string,
  locale: "en" | "es" = "en",
): string {
  return isNotSolid(result.product) ? tr(locale, "bench.notSolid") : value;
}

function makeNotebookId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function GoalNumberField({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number | undefined;
  unit: string;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="bench-field">
      <span className="bench-field-label">{label}</span>
      <span className="bench-goal-input-wrap">
        <input
          className="input"
          type="number"
          min={0}
          value={value ?? ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? undefined : Number(event.target.value))
          }
        />
        <span className="bench-unit">{unit}</span>
      </span>
    </label>
  );
}

function conditionSummary(experiment: Experiment, locale: "en" | "es"): string {
  const { conditions } = experiment;
  const forming = {
    beaker: tr(locale, "bench.beaker"),
    "extrude-air": tr(locale, "bench.extrudeAir"),
    "extrude-bath": tr(locale, "bench.extrudeBath"),
    "cast-film": tr(locale, "bench.castFilm"),
    "heat-cure": tr(locale, "bench.heatCure"),
  }[conditions.forming];
  return tr(locale, "bench.candidateConditions", {
    temperature: conditions.tempC,
    ph: effectivePH(experiment).toLocaleString(locale === "es" ? "es" : "en-US", { maximumFractionDigits: 1 }),
    pressure: conditions.pressureKPa,
    forming,
  });
}

function candidateTargetStatus(goal: Goal, result: RunResult, locale: "en" | "es"): {
  label: string;
  met: boolean;
} {
  const misses: string[] = [];
  if (goal.minTensileMPa && result.tensileMPa < goal.minTensileMPa) {
    misses.push(tr(locale, "bench.candidateStrengthMiss", { need: formatMPa(goal.minTensileMPa), got: formatMPa(result.tensileMPa) }));
  }
  if (goal.minElongationPct && result.elongationPct < goal.minElongationPct) {
    misses.push(tr(locale, "bench.candidateStretchMiss", { need: formatPercent(goal.minElongationPct), got: formatPercent(result.elongationPct) }));
  }
  if (goal.minTack && result.tack < goal.minTack) {
    misses.push(tr(locale, "bench.candidateTackMiss", { need: formatTack(goal.minTack), got: formatTack(result.tack) }));
  }
  if (goal.maxSetSeconds && result.setSeconds > goal.maxSetSeconds) {
    misses.push(tr(locale, "bench.candidateSetMiss", { max: showTime(goal.maxSetSeconds, locale), got: showTime(result.setSeconds, locale) }));
  }
  if (goal.maxCostPerKg && result.costPerKg > goal.maxCostPerKg) {
    misses.push(tr(locale, "bench.candidateCostMiss", { max: formatCost(goal.maxCostPerKg), got: formatCost(result.costPerKg) }));
  }
  if (goal.skinSafe && (result.skin > 1 || result.curedToxicity > 1)) {
    misses.push(tr(locale, "bench.candidateSkinMiss"));
  }
  if (goal.edible && !result.edible) misses.push(tr(locale, "bench.candidateEdibleMiss"));
  if (goal.water && goal.water !== "any" && result.water !== goal.water) {
    misses.push(tr(locale, "bench.candidateWaterMiss", {
      need: tr(locale, `bench.water.${goal.water}`),
    }));
  }
  if (goal.product && goal.product !== "any" && result.product !== goal.product) {
    misses.push(tr(locale, "bench.candidateProductMiss", {
      need: tr(locale, `bench.product.${goal.product}`),
    }));
  }
  return {
    label: misses.length ? tr(locale, "bench.targetMisses", { misses: misses.join("; ") }) : tr(locale, "bench.targetsMet"),
    met: misses.length === 0,
  };
}

function partsSummary(experiment: Experiment, locale: "en" | "es"): string {
  return experiment.parts
    .map((part) =>
      `${trText(locale, benchById[part.id]?.name ?? (part.id.startsWith(CUSTOM_PREFIX) ? tr(locale, "bench.deletedIngredient") : part.id))} ${part.pct}%`,
    )
    .join(", ") || tr(locale, "bench.noIngredients");
}

export default function BenchTool() {
  const { locale, t } = useT();
  const {
    list: customList,
    ready: customReady,
    save: saveCustomIngredient,
    saveMany: saveManyCustomIngredients,
    remove: removeCustomIngredient,
  } = useCustomIngredients();
  const [experiment, setExperiment] = useState<Experiment>(() =>
    ({ parts: [], conditions: DEFAULT_CONDITIONS }),
  );
  const [selectedPreset, setSelectedPreset] = useState("");
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<IngredientFilter>("All");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);
  const [runError, setRunError] = useState("");
  const [lastRunExperiment, setLastRunExperiment] = useState<Experiment | null>(null);
  const [runId, setRunId] = useState(0);
  const [notebook, setNotebook] = useState<NotebookEntry[]>([]);
  const [notebookName, setNotebookName] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareVisible, setCompareVisible] = useState(false);
  const [goal, setGoal] = useState<Goal>({
    minTensileMPa: 200,
    minElongationPct: 20,
    skinSafe: true,
  });
  const [poolMode, setPoolMode] = useState<"all" | "selected">("all");
  const [maxIngredients, setMaxIngredients] = useState(4);
  const [keepConditions, setKeepConditions] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [searchTimeMs, setSearchTimeMs] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [optimizerError, setOptimizerError] = useState("");
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [customFormInitial, setCustomFormInitial] = useState<BenchIngredient>();
  const [customSaveError, setCustomSaveError] = useState("");
  const [shareNotice, setShareNotice] = useState<{ invalid: boolean; dropped: string[] } | null>(null);
  const [shareUndo, setShareUndo] = useState<BenchShareUndo | null>(null);
  const [sharedTestId, setSharedTestId] = useState<BenchTestId | null>(null);
  const [shareTestVersion, setShareTestVersion] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedExperiment = localStorage.getItem(CURRENT_KEY);
        if (savedExperiment) {
          const parsed = JSON.parse(savedExperiment) as Experiment;
          const silkFiberPreset = benchPresets.find((preset) => preset.id === "spider-web");
          const isLegacySilkFiber = silkFiberPreset &&
            Array.isArray(parsed.parts) &&
            parsed.conditions &&
            experimentsEqual(parsed, silkFiberPreset.experiment);
          if (Array.isArray(parsed.parts) && parsed.conditions && !isLegacySilkFiber) {
            setExperiment(cloneExperiment(parsed));
            setSelectedPreset("custom");
          }
        }
        const savedNotebook = localStorage.getItem(NOTEBOOK_KEY);
        if (savedNotebook) {
          const parsed = JSON.parse(savedNotebook) as NotebookEntry[];
          if (Array.isArray(parsed)) setNotebook(parsed.slice(0, 50));
        }
      } catch {
        localStorage.removeItem(CURRENT_KEY);
        localStorage.removeItem(NOTEBOOK_KEY);
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || !customReady) return;

    const openShare = () => {
      const encoded = readShareHash(window.location.hash);
      if (encoded === null) return;

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      const decoded = decodeShare(encoded);
      if (!decoded || decoded.payload.kind !== "bench") {
        setShareUndo(null);
        setShareNotice({ invalid: true, dropped: [] });
        return;
      }

      let previousTestId: string | null = null;
      try {
        previousTestId = window.localStorage.getItem("elementlab.bench.test");
      } catch {
        previousTestId = null;
      }
      if (experiment.parts.length > 0) {
        setShareUndo({
          experiment: cloneExperiment(experiment),
          selectedPreset,
          result,
          lastRunExperiment: lastRunExperiment
            ? cloneExperiment(lastRunExperiment)
            : null,
          testId: previousTestId,
        });
      } else {
        setShareUndo(null);
      }

      const idMap = new Map<string, string>();
      const planned = new Map(customList.map((ingredient) => [ingredient.id, ingredient]));
      const additions: BenchIngredient[] = [];
      for (const ingredient of decoded.payload.custom ?? []) {
        const existing = planned.get(ingredient.id);
        if (existing && JSON.stringify(existing) === JSON.stringify(ingredient)) {
          idMap.set(ingredient.id, ingredient.id);
          continue;
        }

        let imported = ingredient;
        if (existing) {
          const plannedIds = new Set(planned.keys());
          let id = newCustomId();
          while (plannedIds.has(id)) id = `${newCustomId()}-${plannedIds.size}`;
          imported = { ...ingredient, id };
        }
        planned.set(imported.id, imported);
        idMap.set(ingredient.id, imported.id);
        additions.push(imported);
      }

      let savedCustom = customList;
      if (additions.length > 0) {
        try {
          savedCustom = saveManyCustomIngredients(additions);
        } catch {
          savedCustom = customList;
        }
      }
      const savedIds = new Set(savedCustom.map((ingredient) => ingredient.id));
      const dropped = new Set(decoded.dropped);
      const parts = decoded.payload.experiment.parts.flatMap((part) => {
        const id = idMap.get(part.id) ?? part.id;
        if (part.id.startsWith(CUSTOM_PREFIX) && !savedIds.has(id)) {
          dropped.add(part.id);
          return [];
        }
        return [{ ...part, id }];
      });
      const previousBathId = decoded.payload.experiment.conditions.bathId;
      const bathId = previousBathId
        ? idMap.get(previousBathId) ?? previousBathId
        : undefined;
      const conditions = {
        ...decoded.payload.experiment.conditions,
        bathId:
          bathId && bathId.startsWith(CUSTOM_PREFIX) && !savedIds.has(bathId)
            ? DEFAULT_CONDITIONS.bathId
            : bathId,
      };
      const nextExperiment = { parts, conditions };

      if (decoded.payload.testId) {
        try {
          window.localStorage.setItem("elementlab.bench.test", decoded.payload.testId);
        } catch {
          // The share state still opens if storage is unavailable.
        }
      }
      setSharedTestId(decoded.payload.testId ?? null);
      setShareTestVersion((version) => version + 1);
      setExperiment(nextExperiment);
      setSelectedPreset("custom");
      setResult(null);
      setLastRunExperiment(null);
      setRunError("");
      setShareNotice({ invalid: false, dropped: [...dropped] });
    };

    openShare();
    window.addEventListener("hashchange", openShare);
    return () => window.removeEventListener("hashchange", openShare);
  }, [
    ready,
    customReady,
    customList,
    saveManyCustomIngredients,
    experiment,
    selectedPreset,
    result,
    lastRunExperiment,
  ]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(CURRENT_KEY, JSON.stringify(experiment));
  }, [experiment, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notebook.slice(0, 50)));
  }, [notebook, ready]);

  const visibleIngredients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const customIds = new Set(customList.map((ingredient) => ingredient.id));
    return allBenchIngredients().filter((ingredient) => {
      if (ingredient.id.startsWith(CUSTOM_PREFIX) && !customIds.has(ingredient.id)) return false;
      if (!ingredientMatchesFilter(ingredient, filter)) return false;
      if (!normalizedQuery) return true;
      return `${ingredient.name} ${ingredient.formula} ${ingredient.id}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [customList, filter, query]);

  const totalPct = experiment.parts.reduce((total, part) => total + part.pct, 0);
  const livePH = effectivePH(experiment);
  const changedSinceRun =
    result !== null &&
    lastRunExperiment !== null &&
    JSON.stringify(experiment) !== JSON.stringify(lastRunExperiment);

  const scene = useMemo(
    () => (result && lastRunExperiment ? buildMixScene(lastRunExperiment, result) : null),
    [result, lastRunExperiment],
  );

  function updateExperiment(next: Experiment) {
    setExperiment(next);
    setSelectedPreset("custom");
    setRunError("");
  }

  function setCondition<K extends keyof Conditions>(key: K, value: Conditions[K]) {
    updateExperiment({
      ...experiment,
      conditions: { ...experiment.conditions, [key]: value },
    });
  }

  function addIngredient(id: string) {
    if (experiment.parts.some((part) => part.id === id)) return;
    updateExperiment({
      ...experiment,
      parts: [...experiment.parts, { id, pct: 1 }],
    });
  }

  function openNewCustomIngredient() {
    setCustomFormInitial(undefined);
    setCustomSaveError("");
    setCustomFormOpen(true);
  }

  function openCustomIngredient(ingredient: BenchIngredient) {
    setCustomFormInitial(ingredient);
    setCustomSaveError("");
    setCustomFormOpen(true);
  }

  function saveCustom(ingredient: BenchIngredient) {
    try {
      saveCustomIngredient(ingredient);
      setCustomSaveError("");
      setCustomFormOpen(false);
      if (experiment.parts.some((part) => part.id === ingredient.id)) {
        setResult(null);
        setLastRunExperiment(null);
      }
      if (!customFormInitial) {
        setFilter("Mine");
        setQuery("");
      }
    } catch (error) {
      setCustomSaveError(
        error instanceof Error ? error.message : "Could not save this ingredient.",
      );
    }
  }

  function deleteOpenCustomIngredient() {
    if (!customFormInitial) return;
    const id = customFormInitial.id;
    try {
      removeCustomIngredient(id);
    } catch (error) {
      setCustomSaveError(
        error instanceof Error ? error.message : "Could not delete this ingredient.",
      );
      return;
    }
    if (experiment.parts.some((part) => part.id === id)) {
      updateExperiment({
        ...experiment,
        parts: experiment.parts.filter((part) => part.id !== id),
      });
      setResult(null);
      setLastRunExperiment(null);
    }
    setCustomSaveError("");
    setCustomFormOpen(false);
    setCustomFormInitial(undefined);
  }

  function setPartPct(index: number, pct: number) {
    const parts = experiment.parts.map((part, partIndex) =>
      partIndex === index ? { ...part, pct: Math.max(0, Math.min(100, pct)) } : part,
    );
    updateExperiment({ ...experiment, parts });
  }

  function movePart(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= experiment.parts.length) return;
    const parts = [...experiment.parts];
    [parts[index], parts[target]] = [parts[target], parts[index]];
    updateExperiment({ ...experiment, parts });
  }

  function runExperiment(value: Experiment = experiment) {
    const snapshot = cloneExperiment(value);
    if (!snapshot.parts.some((part) => Number.isFinite(part.pct) && part.pct > 0)) {
      setRunError(t("ui.addIngredientsStart"));
      return;
    }
    setRunError("");
    const nextResult = simulate(snapshot, locale);
    setResult(nextResult);
    setLastRunExperiment(snapshot);
    setRunId((id) => id + 1);
    const name = notebookName.trim() || `${t("bench.experiment")} ${new Date().toLocaleString(locale === "es" ? "es" : "en-US")}`;
    const entry: NotebookEntry = {
      id: makeNotebookId(),
      name,
      createdAt: new Date().toISOString(),
      experiment: snapshot,
      result: nextResult,
    };
    setNotebook((previous) => [entry, ...previous].slice(0, 50));
    setCompareVisible(false);
  }

  function loadPreset(id: string) {
    const preset = benchPresets.find((item) => item.id === id);
    if (!preset) return;
    setExperiment(cloneExperiment(preset.experiment));
    setSelectedPreset(preset.id);
    setRunError("");
  }

  function loadNotebookEntry(entry: NotebookEntry) {
    const snapshot = cloneExperiment(entry.experiment);
    setExperiment(snapshot);
    setSelectedPreset("custom");
    setResult(entry.result);
    setLastRunExperiment(snapshot);
    setRunId((id) => id + 1);
    setCompareVisible(false);
  }

  function toggleCompare(id: string) {
    setCompareIds((previous) => {
      if (previous.includes(id)) return previous.filter((value) => value !== id);
      if (previous.length >= 3) return [...previous.slice(1), id];
      return [...previous, id];
    });
    setCompareVisible(false);
  }

  function exportNotebook() {
    const blob = new Blob([JSON.stringify(notebook, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "science-lab-notebook.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearNotebook() {
    if (!window.confirm(t("bench.clearConfirm"))) return;
    setNotebook([]);
    setCompareIds([]);
    setCompareVisible(false);
  }

  async function findMixes() {
    const pool =
      poolMode === "all"
        ? allBenchIngredients().map((ingredient) => ingredient.id)
        : experiment.parts.map((part) => part.id);
    if (pool.length === 0) {
      setOptimizerError(t("bench.optimizerEmptyPool"));
      return;
    }
    setOptimizerError("");
    setOptimizing(true);
    setProgress({ completed: 0, total: 2500 });
    setSearchTimeMs(null);
    const start = performance.now();
    try {
      const found = await findBestMixesAsync(
        goal,
        {
          pool,
          maxIngredients,
          budget: 2500,
          seed: 1,
          lockConditions: keepConditions ? experiment.conditions : undefined,
        },
        (completed, total) => setProgress({ completed, total }),
      );
      setCandidates(found);
      setSearchTimeMs(performance.now() - start);
    } catch {
      setOptimizerError(t("bench.optimizerFailed"));
    } finally {
      setOptimizing(false);
    }
  }

  const comparisonEntries = compareIds
    .map((id) => notebook.find((entry) => entry.id === id))
    .filter((entry): entry is NotebookEntry => Boolean(entry));
  const comparison = comparisonEntries.length >= 2
    ? compareRuns(comparisonEntries.map(({ name, experiment, result }) => ({ name, experiment, result })))
    : null;

  function undoSharedExperiment() {
    if (!shareUndo) return;
    setExperiment(cloneExperiment(shareUndo.experiment));
    setSelectedPreset(shareUndo.selectedPreset);
    setResult(shareUndo.result);
    setLastRunExperiment(
      shareUndo.lastRunExperiment
        ? cloneExperiment(shareUndo.lastRunExperiment)
        : null,
    );
    if (isBenchTestId(shareUndo.testId)) {
      try {
        window.localStorage.setItem("elementlab.bench.test", shareUndo.testId);
      } catch {
        // The previous mix can still be restored without storage.
      }
      setSharedTestId(shareUndo.testId);
    } else {
      try {
        window.localStorage.setItem("elementlab.bench.test", "shoot");
      } catch {
        // The previous mix can still be restored without storage.
      }
      setSharedTestId("shoot");
    }
    setShareTestVersion((version) => version + 1);
    setShareUndo(null);
    setShareNotice(null);
  }

  function buildBenchShare(experimentToShare = experiment) {
    const usedIds = new Set(experimentToShare.parts.map((part) => part.id));
    if (experimentToShare.conditions.bathId) usedIds.add(experimentToShare.conditions.bathId);
    let storedTestId: string | null = null;
    try {
      storedTestId = window.localStorage.getItem("elementlab.bench.test");
    } catch {
      storedTestId = null;
    }
    return {
      v: 1 as const,
      kind: "bench" as const,
      experiment: cloneExperiment(experimentToShare),
      custom: customList.filter((ingredient) => usedIds.has(ingredient.id)),
      ...(isBenchTestId(storedTestId) ? { testId: storedTestId } : {}),
    };
  }

  return (
    <div className="bench-page">
      <Suspense fallback={null}>
        <QuestBanner mode="mix" experiment={lastRunExperiment} result={result} />
      </Suspense>
      {shareNotice && (
        <ShareNotice
          invalid={shareNotice.invalid}
          dropped={shareNotice.dropped}
          onUndo={shareUndo ? undoSharedExperiment : undefined}
          onDismiss={() => {
            setShareNotice(null);
            setShareUndo(null);
          }}
        />
      )}
      <header className="bench-intro">
        <p className="bench-eyebrow">{t("VIRTUAL EXPERIMENT SANDBOX")}</p>
        <h1>{t("Experiment Bench")}</h1>
        <p>
          {t("ui.benchDescription")}
        </p>
      </header>

      <section className="bench-panel">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">01 · {t("Build")}</p>
            <h2>{t("ui.yourMixture")}</h2>
          </div>
          <div className="bench-preset-control">
            <label htmlFor="bench-preset">{t("ui.loadPreset")}</label>
            <select
              className="select"
              id="bench-preset"
              value={selectedPreset}
              onChange={(event) => loadPreset(event.target.value)}
            >
              <option value="">{t("ui.choosePreset")}</option>
              <option value="custom">{t("ui.customMix")}</option>
              {benchPresets.map((preset) => (
                <option value={preset.id} key={preset.id}>
                  {trText(locale, preset.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bench-builder-grid">
          <section className="bench-subpanel" aria-labelledby="bench-library-heading">
            <div className="bench-subheading bench-library-heading">
              <h3 id="bench-library-heading">{t("ui.ingredientLibrary")}</h3>
              <span>{visibleIngredients.length} {t("ui.items")}</span>
              <button
                className="button button-secondary bench-custom-create"
                type="button"
                onClick={openNewCustomIngredient}
              >
                {t("ui.makeYourOwn")}
              </button>
            </div>
            {customSaveError && (
              <p className="bench-inline-error" role="alert">{customSaveError}</p>
            )}
            {customFormOpen && (
              <CustomIngredientForm
                key={customFormInitial?.id ?? "new-custom-ingredient"}
                initial={customFormInitial}
                onSave={saveCustom}
                onCancel={() => {
                  setCustomFormOpen(false);
                  setCustomFormInitial(undefined);
                  setCustomSaveError("");
                }}
                onDelete={customFormInitial ? deleteOpenCustomIngredient : undefined}
              />
            )}
            <div className="bench-filter-list" aria-label={t("ui.ingredientCategories")}>
              {filterOptions.map((option) => (
                <button
                  className={`chip bench-chip${filter === option ? " is-active" : ""}`}
                  key={option}
                  type="button"
                  aria-pressed={filter === option}
                  onClick={() => setFilter(option)}
                >
                  {t(`ui.category.${option}`)}
                </button>
              ))}
            </div>
            <label className="bench-search-label" htmlFor="bench-search">
              {t("ui.searchIngredients")}
            </label>
            <input
              id="bench-search"
              className="input"
              type="search"
              placeholder={t("ui.tryCalciumSilk")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="bench-library-list">
              {visibleIngredients.map((ingredient) => {
                const added = experiment.parts.some((part) => part.id === ingredient.id);
                return (
                  <div className="bench-library-item" key={ingredient.id}>
                    <div className="bench-library-copy">
                      <strong>{trText(locale, ingredient.name)}</strong>
                      <span>{ingredient.formula}</span>
                      {ingredient.id.startsWith(CUSTOM_PREFIX) && (
                      <span className="bench-yours-badge">{t("ui.yours")}</span>
                      )}
                    </div>
                    <div className="bench-library-actions">
                      <button
                        className="button button-secondary bench-add-button"
                        type="button"
                        disabled={added}
                        onClick={() => addIngredient(ingredient.id)}
                      >
                        {added ? t("ui.added") : t("ui.add")}
                      </button>
                      {ingredient.id.startsWith(CUSTOM_PREFIX) && (
                        <button
                          className="button button-secondary bench-edit-button"
                          type="button"
                          onClick={() => openCustomIngredient(ingredient)}
                        >
                          {t("ui.edit")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleIngredients.length === 0 && (
                <p className="bench-muted">{t("ui.noIngredientsMatch")}</p>
              )}
            </div>
          </section>

          <section className="bench-subpanel" aria-labelledby="bench-mix-heading">
            <div className="bench-subheading">
              <h3 id="bench-mix-heading">{t("ui.mixingOrder")}</h3>
              <span className={Math.abs(totalPct - 100) > 0.1 ? "bench-total-warn" : ""}>
                {totalPct.toFixed(1)}%
              </span>
            </div>
            {experiment.parts.length === 0 ? (
              <div className="bench-empty">{t("ui.addIngredientsStart")}</div>
            ) : (
              <div className="bench-mix-list">
                {experiment.parts.map((part, index) => {
                  const ingredient = benchById[part.id];
                  if (!ingredient) {
                    if (!part.id.startsWith(CUSTOM_PREFIX)) return null;
                    return (
                      <article className="bench-mix-row" key={`${part.id}-${index}`}>
                        <div className="bench-mix-row-top">
                          <div className="bench-mix-title">
                            <span className="bench-order">{String(index + 1).padStart(2, "0")}</span>
                            <strong>Deleted ingredient</strong>
                          </div>
                        <span className="badge bench-category-badge">{t("bench.custom")}</span>
                        </div>
                        <div className="bench-row-actions">
                          <button
                            className="button button-secondary bench-remove-button"
                            type="button"
                            onClick={() =>
                              updateExperiment({
                                ...experiment,
                                parts: experiment.parts.filter((_, partIndex) => partIndex !== index),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    );
                  }
                  return (
                    <article className="bench-mix-row" key={`${part.id}-${index}`}>
                      <div className="bench-mix-row-top">
                        <div className="bench-mix-title">
                          <span className="bench-order">{String(index + 1).padStart(2, "0")}</span>
                          <strong>{trText(locale, ingredient.name)}</strong>
                        </div>
                        <span className="badge bench-category-badge">{t(`ui.category.${ingredient.category === "acid-base" ? "Acids/Bases" : ingredient.category === "salt" ? "Salts" : ingredient.category === "protein" ? "Proteins" : ingredient.category === "enzyme" ? "Enzymes" : ingredient.category === "polymer" ? "Polymers" : ingredient.category === "solvent" ? "Solvents" : ingredient.category === "additive" ? "Additives" : "Elements"}`)}</span>
                      </div>
                      <div className="bench-mix-controls">
                        <input
                          aria-label={`${trText(locale, ingredient.name)} percentage slider`}
                          className="bench-range"
                          type="range"
                          min="0"
                          max="100"
                          step="0.5"
                          value={part.pct}
                          onChange={(event) => setPartPct(index, Number(event.target.value))}
                        />
                        <label className="bench-percent-field">
                          <span className="sr-only">{trText(locale, ingredient.name)} percentage</span>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={part.pct}
                            onChange={(event) => setPartPct(index, Number(event.target.value) || 0)}
                          />
                          <span>%</span>
                        </label>
                      </div>
                      <div className="bench-row-actions">
                        <button
                          className="button button-secondary bench-icon-button"
                          aria-label={`Move ${trText(locale, ingredient.name)} up`}
                          type="button"
                          disabled={index === 0}
                          onClick={() => movePart(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="button button-secondary bench-icon-button"
                          aria-label={`Move ${trText(locale, ingredient.name)} down`}
                          type="button"
                          disabled={index === experiment.parts.length - 1}
                          onClick={() => movePart(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          className="button button-secondary bench-remove-button"
                          type="button"
                          onClick={() =>
                            updateExperiment({
                              ...experiment,
                              parts: experiment.parts.filter((_, partIndex) => partIndex !== index),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                      <details className="bench-ingredient-details">
                        <summary>{t("bench.howItBonds")}</summary>
                        <p>{trText(locale, ingredient.bonding)}</p>
                        <p>{trText(locale, ingredient.notes)}</p>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
            <div className="bench-mix-footer">
              <button
                className="button button-secondary"
                type="button"
                disabled={experiment.parts.length === 0}
                onClick={() =>
                  updateExperiment({ ...experiment, parts: normalizeMix(experiment.parts) })
                }
              >
                {t("ui.normalizeBench")}
              </button>
            <p>{t("bench.orderMatters")}</p>
            </div>
          </section>
        </div>
      </section>

      <section className="bench-panel" aria-labelledby="bench-conditions-heading">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">02 · {t("Process")}</p>
            <h2 id="bench-conditions-heading">{t("ui.conditions")}</h2>
          </div>
        </div>
        <div className="bench-condition-grid">
          <RangeNumberField
            label={t("bench.temperature")}
            value={experiment.conditions.tempC}
            min={-20}
            max={200}
            step={1}
            unit="°C"
            onChange={(value) => setCondition("tempC", value)}
          />
          <div className="bench-field">
            <span className="bench-field-label"><Term id="ph">pH</Term> {t("bench.phFromIngredients")}</span>
            <output className="bench-ph-value">{livePH.toFixed(1)}</output>
            <span className="bench-ph-hint">
              {t("bench.phHelp")}
            </span>
          </div>
          <RangeNumberField
            label={t("bench.pressure")}
            value={experiment.conditions.pressureKPa}
            min={0.1}
            max={300}
            step={0.1}
            unit="kPa"
            onChange={(value) => setCondition("pressureKPa", value)}
          />
          <label className="bench-field">
            <span className="bench-field-label">{t("bench.atmosphere")}</span>
            <select
              className="select"
              value={experiment.conditions.atmosphere}
              onChange={(event) =>
                setCondition("atmosphere", event.target.value as Conditions["atmosphere"])
              }
            >
              <option value="air">{t("bench.air")}</option>
              <option value="nitrogen">{t("bench.nitrogen")}</option>
              <option value="vacuum">{t("bench.vacuum")}</option>
            </select>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">{t("bench.humidity")}</span>
            <span className="bench-goal-input-wrap">
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={experiment.conditions.humidityPct}
                onChange={(event) => setCondition("humidityPct", Number(event.target.value) || 0)}
              />
              <span className="bench-unit">%</span>
            </span>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">{t("bench.mixingSpeed")}</span>
            <span className="bench-goal-input-wrap">
              <input
                className="input"
                type="number"
                min="0"
                max="3000"
                value={experiment.conditions.mixRpm}
                onChange={(event) => setCondition("mixRpm", Number(event.target.value) || 0)}
              />
              <span className="bench-unit">rpm</span>
            </span>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">{t("bench.mixTime")}</span>
            <span className="bench-goal-input-wrap">
              <input
                className="input"
                type="number"
                min="0"
                max="240"
                value={experiment.conditions.mixMinutes}
                onChange={(event) => setCondition("mixMinutes", Number(event.target.value) || 0)}
              />
              <span className="bench-unit">min</span>
            </span>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">{t("bench.cureTime")}</span>
            <span className="bench-goal-input-wrap">
              <input
                className="input"
                type="number"
                min="0"
                max="1440"
                value={experiment.conditions.cureMinutes}
                onChange={(event) => setCondition("cureMinutes", Number(event.target.value) || 0)}
              />
              <span className="bench-unit">min</span>
            </span>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">{t("bench.formingMethod")}</span>
            <select
              className="select"
              value={experiment.conditions.forming}
              onChange={(event) =>
                setCondition("forming", event.target.value as Conditions["forming"])
              }
            >
              <option value="beaker">{t("bench.beaker")}</option>
              <option value="extrude-air">{t("bench.extrudeAir")}</option>
              <option value="extrude-bath">{t("bench.extrudeBath")}</option>
              <option value="cast-film">{t("bench.castFilm")}</option>
              <option value="heat-cure">{t("bench.heatCure")}</option>
            </select>
          </label>
          {experiment.conditions.forming === "extrude-bath" && (
            <label className="bench-field">
              <span className="bench-field-label">{t("bench.bathIngredient")}</span>
              <select
                className="select"
                value={experiment.conditions.bathId ?? ""}
                onChange={(event) => setCondition("bathId", event.target.value || undefined)}
              >
                <option value="">{t("bench.chooseBath")}</option>
                {allBenchIngredients()
                  .filter((ingredient) => ["salt", "solvent"].includes(ingredient.category))
                  .map((ingredient) => (
                    <option value={ingredient.id} key={ingredient.id}>
                      {trText(locale, ingredient.name)}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        <div className="bench-condition-chips">
          {[
            { label: t("bench.vacuumChip", { pressure: 1 }), value: 1 },
            { label: t("bench.roomChip", { pressure: 101 }), value: 101 },
            { label: t("bench.pressurizedChip", { pressure: 200 }), value: 200 },
          ].map((chip) => (
            <button
              className="chip bench-chip"
              type="button"
              key={chip.label}
              onClick={() => setCondition("pressureKPa", chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <p className="bench-condition-note">
          {t("bench.waterBoilsAt", {
            temperature: waterBoilingPointC(experiment.conditions.pressureKPa).toLocaleString(locale === "es" ? "es" : "en-US", { maximumFractionDigits: 1 }),
            ph: livePH.toLocaleString(locale === "es" ? "es" : "en-US", { maximumFractionDigits: 1 }),
          })}
        </p>
      </section>

      <section className="bench-run-panel" aria-label="Run experiment">
        <label className="bench-run-name">
          <span>{t("bench.notebookName")}</span>
          <input
            className="input"
            value={notebookName}
            placeholder={t("bench.notebookPlaceholder")}
            onChange={(event) => setNotebookName(event.target.value)}
          />
        </label>
        <div className="bench-run-actions">
          <button className="button bench-run-button" type="button" onClick={() => runExperiment()}>
            {t("ui.runExperiment")}
          </button>
          <ShareButton
            build={buildBenchShare}
            label={t("bench.shareExperiment")}
            disabledReason={experiment.parts.length ? undefined : t("bench.addIngredientFirst")}
          />
        </div>
        {runError && <p className="bench-empty" role="alert">{runError}</p>}
      </section>

      <section className="bench-panel" aria-labelledby="bench-results-heading">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">03 · {t("ui.results").toUpperCase()}</p>
            <h2 id="bench-results-heading">{t("ui.whatFormed")}</h2>
          </div>
          {changedSinceRun && <span className="bench-changed">{t("bench.resultsChanged")}</span>}
        </div>
        {!result ? (
          <div className="bench-empty">
            {t("bench.resultsEmpty")}
          </div>
        ) : (
          <div className="bench-results" aria-live="polite">
            <div className={`bench-product bench-product-${result.product}`}>
              <div>
                <span className="bench-product-label">{t("bench.estimatedProduct")}</span>
                <h3>{result.productLabel}</h3>
                <p>{result.summary}</p>
              </div>
              <span className="bench-confidence">
                {result.confidence >= 0.8 ? t("bench.confidenceHigh") : result.confidence >= 0.5 ? t("bench.confidenceMedium") : t("bench.confidenceLow")}{" "}
                <Term id="confidence">confidence</Term> · {Math.round(result.confidence * 100)}%
              </span>
            </div>
            {scene && (
              <section className="bench-result-section" aria-label={t("bench.watchExperiment")}>
                <h3>{t("bench.watchHappen")}</h3>
                <MixViewer key={runId} scene={scene} resultLabel={result.productLabel} />
              </section>
            )}
            <section className="bench-result-section" aria-label={t("ui.testIt")}>
              <h3>{t("ui.testIt")}</h3>
              {lastRunExperiment && (
                <BenchTests
                  key={`${runId}-${shareTestVersion}`}
                  runId={runId}
                  experiment={lastRunExperiment}
                  result={result}
                  shareTestId={sharedTestId}
                  onTestSummary={setTestSummary}
                />
              )}
            </section>
            <div className="bench-metric-grid">
              <Metric label={t("bench.tensileStrength")} value={formattedMechanicalValue(result, `${formatMPa(result.tensileMPa)} MPa`, locale)} />
              <Metric label={t("bench.stretch")} value={formattedMechanicalValue(result, `${formatPercent(result.elongationPct)}%`, locale)} />
              <Metric label={t("bench.stickiness")} value={formattedMechanicalValue(result, `${formatTack(result.tack)}/10`, locale)} />
              <Metric label={t("bench.toughness")} value={formattedMechanicalValue(result, `${formatToughness(result.toughnessMJm3)} MJ/m³`, locale)} />
              <Metric label={t("bench.setTime")} value={showTime(result.setSeconds, locale)} />
              <Metric label={t("bench.costEstimate")} value={`$${formatCost(result.costPerKg)}/kg`} />
            </div>
            <div className="bench-safety-grid">
              <SafetyMetric label={t("bench.toxicityMixing")} value={hazardLabel(result.wetToxicity)} />
              <SafetyMetric label={t("bench.curedToxicity")} value={hazardLabel(result.curedToxicity)} />
              <SafetyMetric label={t("bench.skinContact")} value={hazardLabel(result.skin)} />
              <SafetyMetric label={t("bench.edible")} value={result.edible ? t("bench.yes") : t("bench.no")} />
              <SafetyMetric
                label={t("bench.waterBehavior")}
                value={`${result.water} · ${result.dissolveTime}`}
              />
              <SafetyMetric label={t("bench.biodegradable")} value={result.biodegradable ? t("bench.yes") : t("bench.no")} />
            </div>
            <section className="bench-result-section">
              <h3>{t("bench.whatHappened")}</h3>
              {result.events.length === 0 ? (
                <p className="bench-muted">{t("bench.noReactionMatched")}</p>
              ) : (
                <div className="bench-event-list">
                  {result.events.map((event) => (
                    <article className={`bench-event bench-event-${event.status}`} key={event.id}>
                      <span className="bench-event-icon" aria-hidden="true">
                        {event.status === "happened" ? "✓" : event.status === "partial" ? "◐" : "×"}
                      </span>
                      <div>
                        <div className="bench-event-title">
                          <strong><TermLabel label={event.name} /></strong>
                          <span>{t(`bench.eventStatus.${event.status}`, { value: event.activity.toLocaleString(locale === "es" ? "es" : "en-US", { maximumFractionDigits: 2 }) })} · {t("bench.activity", { value: event.activity.toLocaleString(locale === "es" ? "es" : "en-US", { maximumFractionDigits: 2 }) })}</span>
                        </div>
                        <p>{event.mechanism}</p>
                        {event.reasons.length > 0 && (
                          <ul>
                            {event.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                          </ul>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            {result.warnings.length > 0 && (
              <section className="bench-result-section">
                <h3>{t("bench.warningsNotes")}</h3>
                <ul className="bench-warning-list">
                  {result.warnings.map((warning) => (
                    <li className={`bench-warning bench-warning-${warning.level}`} key={warning.text}>
                      {warning.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="bench-result-section">
              <h3>{t("bench.notModelled")}</h3>
              {result.notModelled.length > 0 ? (
                <ul className="bench-unknown-list">
                  {result.notModelled.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p className="bench-muted">{t("bench.noUnmodelled")}</p>
              )}
              <p className="bench-confidence-note">
                {t("bench.confidenceNote")}
              </p>
            </section>
          </div>
        )}
        <LabReportButton
          disabledReason={!result || !lastRunExperiment ? t("bench.runFirst") : undefined}
          build={(extra) => {
            if (!result || !lastRunExperiment) return null;
            const payload = buildBenchShare(lastRunExperiment);
            const url = shareUrl(
              window.location.origin,
              `${window.location.pathname}${window.location.search}`,
              payload,
            );
            return benchReport(lastRunExperiment, result, testSummary ?? undefined, {
              ...extra,
              shareUrl: url,
            }, locale);
          }}
        />
      </section>

      <section className="bench-panel" aria-labelledby="bench-optimizer-heading">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">04 · {t("bench.search")}</p>
            <h2 id="bench-optimizer-heading">{t("bench.findBest")}</h2>
          </div>
          <span className="bench-live-value">{t("bench.ruleSearch")}</span>
        </div>
        <p className="bench-panel-copy">{t("bench.searchIntro")}</p>
        <div className="bench-goal-grid">
          <GoalNumberField
            label={t("bench.minimumTensile")}
            value={goal.minTensileMPa}
            unit="MPa"
            onChange={(value) => setGoal({ ...goal, minTensileMPa: value })}
          />
          <GoalNumberField
            label={t("bench.minimumStretch")}
            value={goal.minElongationPct}
            unit="%"
            onChange={(value) => setGoal({ ...goal, minElongationPct: value })}
          />
          <GoalNumberField
            label={t("bench.minimumStickiness")}
            value={goal.minTack}
            unit="/10"
            onChange={(value) => setGoal({ ...goal, minTack: value })}
          />
          <GoalNumberField
            label={t("bench.maximumSetTime")}
            value={goal.maxSetSeconds === undefined ? undefined : goal.maxSetSeconds / 60}
            unit="min"
            onChange={(value) =>
              setGoal({ ...goal, maxSetSeconds: value === undefined ? undefined : value * 60 })
            }
          />
          <GoalNumberField
            label={t("bench.maximumCost")}
            value={goal.maxCostPerKg}
            unit="$/kg"
            onChange={(value) => setGoal({ ...goal, maxCostPerKg: value })}
          />
          <label className="bench-field">
            <span className="bench-field-label">{t("bench.waterBehavior")}</span>
            <select
              className="select"
              value={goal.water ?? "any"}
              onChange={(event) =>
                setGoal({ ...goal, water: event.target.value as Goal["water"] })
              }
            >
              <option value="any">{t("bench.any")}</option>
              <option value="resists">{t("bench.resists")}</option>
              <option value="dissolves">{t("bench.dissolves")}</option>
            </select>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">{t("ui.productType")}</span>
            <select
              className="select"
              value={goal.product ?? "any"}
              onChange={(event) =>
                setGoal({ ...goal, product: event.target.value as Goal["product"] })
              }
            >
              <option value="any">{t("bench.any")}</option>
              <option value="fiber">{t("bench.fiber")}</option>
              <option value="film">{t("bench.film")}</option>
              <option value="gel">{t("bench.gel")}</option>
              <option value="adhesive">{t("bench.adhesive")}</option>
            </select>
          </label>
        </div>
        <div className="bench-toggle-row">
          <label className="bench-check">
            <input
              type="checkbox"
              checked={Boolean(goal.skinSafe)}
              onChange={(event) => setGoal({ ...goal, skinSafe: event.target.checked })}
            />
            <span>{t("bench.skinSafe")}</span>
          </label>
          <label className="bench-check">
            <input
              type="checkbox"
              checked={Boolean(goal.edible)}
              onChange={(event) => setGoal({ ...goal, edible: event.target.checked })}
            />
            <span>{t("bench.edible")}</span>
          </label>
        </div>
        <fieldset className="bench-pool-options">
          <legend>{t("bench.ingredientPool")}</legend>
          <label className="bench-check">
            <input
              type="radio"
              name="bench-pool"
              checked={poolMode === "all"}
              onChange={() => setPoolMode("all")}
            />
            <span>{t("bench.wholeLibrary")}</span>
          </label>
          <label className="bench-check">
            <input
              type="radio"
              name="bench-pool"
              checked={poolMode === "selected"}
              onChange={() => setPoolMode("selected")}
            />
            <span>{t("bench.selectedIngredients", { count: experiment.parts.length })}</span>
          </label>
        </fieldset>
        <div className="bench-search-options">
          <label className="bench-field bench-max-field">
            <span className="bench-field-label">{t("bench.maximumIngredients")}</span>
            <select
              className="select"
              value={maxIngredients}
              onChange={(event) => setMaxIngredients(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label className="bench-check">
            <input
              type="checkbox"
              checked={keepConditions}
              onChange={(event) => setKeepConditions(event.target.checked)}
            />
            <span>{t("bench.keepConditions")}</span>
          </label>
        </div>
        <div className="bench-search-actions">
          <button
            className="button bench-find-button"
            type="button"
            disabled={optimizing}
            onClick={() => void findMixes()}
          >
            {optimizing ? t("bench.searching") : t("bench.findBest")}
          </button>
          {searchTimeMs !== null && !optimizing && (
            <span className="bench-search-time">{t("bench.searchFinished", { ms: searchTimeMs.toLocaleString(locale === "es" ? "es" : "en-US", { maximumFractionDigits: 0 }) })}</span>
          )}
        </div>
        {optimizing && (
          <div className="bench-progress" aria-live="polite">
            <progress max={progress.total || 2500} value={progress.completed} />
            <span>{progress.completed.toLocaleString(locale === "es" ? "es" : "en-US")} / {progress.total.toLocaleString(locale === "es" ? "es" : "en-US")} {t("ui.mixesChecked")}</span>
          </div>
        )}
        {optimizerError && <p className="bench-inline-error">{optimizerError}</p>}
        {candidates.length > 0 && (
          <div className="bench-candidate-list">
            <h3>{t("bench.topCandidates")}</h3>
            {candidates.map((candidate, index) => (
              <article className="bench-candidate-card" key={`${candidate.experiment.parts.map((part) => part.id).sort().join("-")}-${index}`}>
                <div className="bench-candidate-head">
                  <span className="bench-rank">#{index + 1}</span>
                  <span className="badge bench-category-badge">{candidate.result.productLabel}</span>
                  <span className={`bench-target-status ${candidateTargetStatus(goal, candidate.result, locale).met ? "is-met" : "is-missed"}`}>
                    {candidateTargetStatus(goal, candidate.result, locale).label}
                  </span>
                </div>
                <p className="bench-candidate-parts">{partsSummary(candidate.experiment, locale)}</p>
                <p className="bench-candidate-conditions">{conditionSummary(candidate.experiment, locale)}</p>
                <div className="bench-candidate-metrics">
                  <span>{formattedMechanicalValue(candidate.result, `${formatMPa(candidate.result.tensileMPa)} MPa`, locale)}</span>
                  <span>{formattedMechanicalValue(candidate.result, `${formatPercent(candidate.result.elongationPct)}% ${t("bench.stretch")}`, locale)}</span>
                  <span>{formattedMechanicalValue(candidate.result, `${formatTack(candidate.result.tack)}/10 ${t("bench.stickiness").toLowerCase()}`, locale)}</span>
                  <span>{showTime(candidate.result.setSeconds, locale)}</span>
                </div>
                <ul>
                  {candidate.why.map((why) => <li key={why}>{why}</li>)}
                </ul>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    const loaded = cloneExperiment(candidate.experiment);
                    updateExperiment(loaded);
                    runExperiment(loaded);
                  }}
                >
                  {t("bench.loadIntoBench")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bench-panel" aria-labelledby="bench-notebook-heading">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">05 · RECORD</p>
            <h2 id="bench-notebook-heading">Notebook</h2>
          </div>
          <span className="bench-live-value">{t("bench.runsCount", { count: notebook.length })}</span>
        </div>
        <div className="bench-notebook-actions">
          <button className="button button-secondary" type="button" disabled={!notebook.length} onClick={exportNotebook}>
            {t("bench.exportJson")}
          </button>
          <button className="button button-secondary" type="button" disabled={!notebook.length} onClick={clearNotebook}>
            {t("bench.clearNotebook")}
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={compareIds.length < 2}
            onClick={() => setCompareVisible(true)}
          >
            {t("bench.compareSelected", { count: compareIds.length })}
          </button>
        </div>
        {compareVisible && comparison && (
          <div className="bench-comparison">
            <div className="bench-compare-why">
              <h3>{t("bench.whatChanged")}</h3>
              <ul>
                {comparison.why.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
              </ul>
            </div>
            <div className="bench-table-wrap">
              <table className="bench-compare-table">
                <thead>
                  <tr>
                    <th scope="col">{t("bench.compare")}</th>
                    {comparison.names.map((name, index) => (
                      <th scope="col" key={`${index}-${name}`}>
                        <div className="bench-compare-column-heading">
                          <span>{name}</span>
                          <button
                            className="bench-compare-load"
                            type="button"
                            onClick={() => loadNotebookEntry(comparisonEntries[index])}
                          >
                            {t("bench.load")}
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <ComparisonSection heading={t("bench.sectionIngredients")} colSpan={comparison.names.length + 1} />
                  {comparison.ingredients.map((ingredient) => (
                    <tr key={`ingredient-${ingredient.id}`}>
                      <th scope="row">
                        {trText(locale, ingredient.name)}
                        {ingredient.changed && <ChangedTag text={t("bench.changed")} />}
                      </th>
                      {ingredient.pcts.map((pct, index) => (
                        <td key={index}>{pct === null ? "—" : `${Number.isInteger(pct) ? pct : Number(pct.toFixed(1))}%`}</td>
                      ))}
                    </tr>
                  ))}
                  <ComparisonSection heading={t("bench.sectionConditions")} colSpan={comparison.names.length + 1} />
                  {comparison.conditions.map((condition) => (
                    <tr key={`condition-${condition.label}`}>
                      <th scope="row">
                        <TermLabel label={condition.label} />
                        {condition.changed && <ChangedTag text={t("bench.changed")} />}
                      </th>
                      {condition.values.map((value, index) => <td key={index}>{value}</td>)}
                    </tr>
                  ))}
                  <ComparisonSection heading={t("bench.sectionResults")} colSpan={comparison.names.length + 1} />
                  {comparison.measures.map((measure) => (
                    <tr key={`measure-${measure.label}`}>
                      <th scope="row">
                        <TermLabel label={measure.label} />
                        {measure.values.some((value) => value !== measure.values[0]) && <ChangedTag text={t("bench.changed")} />}
                      </th>
                      {measure.values.map((value, index) => (
                        <td key={index}>
                          <span>{value}</span>
                          {measure.best === index && <strong className="bench-compare-best">★ {t("bench.best")}</strong>}
                          {measure.deltas[index] !== "—" && <small className="bench-compare-delta">Δ {measure.deltas[index]}</small>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <ComparisonSection heading={t("bench.sectionReactions")} colSpan={comparison.names.length + 1} />
                  {comparison.reactions.map((reaction) => (
                    <tr key={`reaction-${reaction.name}`}>
                      <th scope="row">
                        {trText(locale, reaction.name)}
                        {reaction.changed && <ChangedTag text={t("bench.changed")} />}
                      </th>
                      {reaction.statuses.map((status, index) => (
                        <td key={index}>{status === "absent" ? t("bench.statusAbsent") : t(`bench.eventStatus.${status}`)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {notebook.length === 0 ? (
          <div className="bench-empty">{t("bench.noRuns")}</div>
        ) : (
          <div className="bench-notebook-list">
            {notebook.map((entry) => (
              <article className="bench-notebook-entry" key={entry.id}>
                <label className="bench-compare-check">
                  <input
                    type="checkbox"
                    checked={compareIds.includes(entry.id)}
                    onChange={() => toggleCompare(entry.id)}
                    aria-label={`Select ${entry.name} for comparison`}
                  />
                </label>
                <button
                  className="bench-notebook-load"
                  type="button"
                  onClick={() => loadNotebookEntry(entry)}
                >
                  <strong>{entry.name}</strong>
                  <span>{new Date(entry.createdAt).toLocaleString(locale === "es" ? "es" : "en-US")}</span>
                  <span>
                    {entry.result.productLabel} · {formattedMechanicalValue(entry.result, `${formatMPa(entry.result.tensileMPa)} MPa`, locale)} · {formattedMechanicalValue(entry.result, `${formatPercent(entry.result.elongationPct)}% ${t("bench.stretch")}`, locale)}
                  </span>
                  <small>{partsSummary(entry.experiment, locale)}</small>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="bench-footer-note">
        {t("bench.footerWarning")}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bench-metric">
      <span><TermLabel label={label} /></span>
      <strong>{value}</strong>
    </div>
  );
}

function SafetyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bench-safety">
      <span><TermLabel label={label} /></span>
      <strong>{value}</strong>
    </div>
  );
}

const TERM_LABELS: Record<string, import("@/lib/glossary").TermId> = {
  mpa: "mpa",
  pka: "pka",
  "tensile strength": "tensile-strength",
  stretch: "stretch",
  tack: "tack",
  stickiness: "tack",
  toughness: "toughness",
  "set time": "set-time",
  viscosity: "viscosity",
  density: "density",
  "surface tension": "surface-tension",
  ph: "ph",
  acid: "acid",
  base: "base",
  buffer: "buffer",
  polymer: "polymer",
  polymers: "polymer",
  proteins: "protein",
  crosslink: "crosslink",
  plasticizer: "plasticizer",
  solvent: "solvent",
  solvents: "solvent",
  filler: "filler",
  enzyme: "enzyme",
  enzymes: "enzyme",
  protein: "protein",
  hydrogel: "hydrogel",
  toxicity: "toxicity",
  confidence: "confidence",
  "half-life": "half-life",
  fission: "fission",
  fusion: "fusion",
  "binding energy": "binding-energy",
  "mass number": "mass-number",
  fissility: "fissility",
};

function TermLabel({ label }: { label: string }) {
  const { locale } = useT();
  const normalized = label.trim().toLowerCase();
  if (normalized === "acids/bases") {
    return <><Term id="acid">{trText(locale, "Acids")}</Term> / <Term id="base">{trText(locale, "Bases")}</Term></>;
  }
  if (normalized.startsWith("toxicity")) {
    const start = label.toLowerCase().indexOf("toxicity");
    return <>{label.slice(0, start)}<Term id="toxicity">{trText(locale, "Toxicity")}</Term>{label.slice(start + "toxicity".length)}</>;
  }
  const id = TERM_LABELS[normalized];
  const translated = trText(locale, label);
  return id ? <Term id={id}>{translated}</Term> : translated;
}

function ComparisonSection({ heading, colSpan }: { heading: string; colSpan: number }) {
  return (
    <tr className="bench-compare-section">
      <th colSpan={colSpan}>{heading}</th>
    </tr>
  );
}

function ChangedTag({ text }: { text: string }) {
  return <span className="bench-compare-changed">{text}</span>;
}
