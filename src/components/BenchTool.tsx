"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtTime, hazardWord } from "@/lib/formula";
import { effectivePH, waterBoilingPointC } from "@/lib/bench/conditions";
import { benchById, benchLibrary } from "@/lib/bench/library";
import { findBestMixesAsync } from "@/lib/bench/optimize";
import { benchPresets } from "@/lib/bench/presets";
import { simulate } from "@/lib/bench/simulate";
import type {
  Candidate,
  Category,
  Conditions,
  Experiment,
  Goal,
  Part,
  RunResult,
} from "@/lib/bench/types";
import "./bench.css";

type IngredientFilter =
  | "All"
  | "Elements"
  | "Salts"
  | "Proteins"
  | "Enzymes"
  | "Polymers"
  | "Solvents"
  | "Acids/Bases"
  | "Additives";

interface NotebookEntry {
  id: string;
  name: string;
  createdAt: string;
  experiment: Experiment;
  result: RunResult;
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
];

function cloneExperiment(experiment: Experiment): Experiment {
  return {
    parts: experiment.parts.map((part) => ({ ...part })),
    conditions: { ...experiment.conditions },
  };
}

function ingredientMatchesFilter(
  category: Category,
  filter: IngredientFilter,
): boolean {
  if (filter === "All") return true;
  if (filter === "Elements") return category === "element" || category === "filler";
  const map: Record<Exclude<IngredientFilter, "All" | "Elements">, Category> = {
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

function showTime(seconds: number): string {
  return seconds > 0 ? fmtTime(seconds) : "Doesn't set on its own";
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

function isNotSolid(product: RunResult["product"]): boolean {
  return ["solution", "nothing", "clumps", "dangerous"].includes(product);
}

function formattedMechanicalValue(
  result: RunResult,
  value: string,
): string {
  return isNotSolid(result.product) ? "— · not a solid" : value;
}

function makeNotebookId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const clampValue = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <label className="bench-field">
      <span className="bench-field-label">{label}</span>
      <span className="bench-field-control">
        <input
          aria-label={`${label} slider`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          className="input bench-number-input"
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(clampValue(Number(event.target.value) || 0))}
        />
        <span className="bench-unit">{unit}</span>
      </span>
    </label>
  );
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

function conditionSummary(conditions: Conditions): string {
  return `${conditions.tempC} °C · pH ${conditions.pH.toFixed(1)} · ${conditions.pressureKPa} kPa · ${conditions.forming}`;
}

function candidateTargetStatus(goal: Goal, result: RunResult): {
  label: string;
  met: boolean;
} {
  const misses: string[] = [];
  if (goal.minTensileMPa && result.tensileMPa < goal.minTensileMPa) {
    misses.push(`strength (needs ${formatMPa(goal.minTensileMPa)}, got ${formatMPa(result.tensileMPa)} MPa)`);
  }
  if (goal.minElongationPct && result.elongationPct < goal.minElongationPct) {
    misses.push(`stretch (needs ${formatPercent(goal.minElongationPct)}%, got ${formatPercent(result.elongationPct)}%)`);
  }
  if (goal.minTack && result.tack < goal.minTack) {
    misses.push(`tack (needs ${formatTack(goal.minTack)}, got ${formatTack(result.tack)})`);
  }
  if (goal.maxSetSeconds && result.setSeconds > goal.maxSetSeconds) {
    misses.push(`set time (max ${showTime(goal.maxSetSeconds)}, got ${showTime(result.setSeconds)})`);
  }
  if (goal.maxCostPerKg && result.costPerKg > goal.maxCostPerKg) {
    misses.push(`cost (max $${formatCost(goal.maxCostPerKg)}/kg, got $${formatCost(result.costPerKg)}/kg)`);
  }
  if (goal.skinSafe && (result.skin > 1 || result.curedToxicity > 1)) {
    misses.push("skin safety");
  }
  if (goal.edible && !result.edible) misses.push("edible");
  if (goal.water && goal.water !== "any" && result.water !== goal.water) {
    misses.push(`water behavior (needs ${goal.water})`);
  }
  if (goal.product && goal.product !== "any" && result.product !== goal.product) {
    misses.push(`product (needs ${goal.product})`);
  }
  return {
    label: misses.length ? `Misses: ${misses.join("; ")}` : "Meets all targets",
    met: misses.length === 0,
  };
}

function partsSummary(experiment: Experiment): string {
  return experiment.parts
    .map((part) => `${benchById[part.id]?.name ?? part.id} ${part.pct}%`)
    .join(", ") || "No ingredients";
}

export default function BenchTool() {
  const [experiment, setExperiment] = useState<Experiment>(() =>
    cloneExperiment(benchPresets[0].experiment),
  );
  const [selectedPreset, setSelectedPreset] = useState(benchPresets[0].id);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<IngredientFilter>("All");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [lastRunExperiment, setLastRunExperiment] = useState<Experiment | null>(null);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedExperiment = localStorage.getItem(CURRENT_KEY);
        if (savedExperiment) {
          const parsed = JSON.parse(savedExperiment) as Experiment;
          if (Array.isArray(parsed.parts) && parsed.conditions) {
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
    if (!ready) return;
    localStorage.setItem(CURRENT_KEY, JSON.stringify(experiment));
  }, [experiment, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notebook.slice(0, 50)));
  }, [notebook, ready]);

  const visibleIngredients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return benchLibrary.filter((ingredient) => {
      if (!ingredientMatchesFilter(ingredient.category, filter)) return false;
      if (!normalizedQuery) return true;
      return `${ingredient.name} ${ingredient.formula} ${ingredient.id}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filter, query]);

  const totalPct = experiment.parts.reduce((total, part) => total + part.pct, 0);
  const livePH = effectivePH(experiment);
  const changedSinceRun =
    result !== null &&
    lastRunExperiment !== null &&
    JSON.stringify(experiment) !== JSON.stringify(lastRunExperiment);

  function updateExperiment(next: Experiment) {
    setExperiment(next);
    setSelectedPreset("custom");
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
    const nextResult = simulate(snapshot);
    setResult(nextResult);
    setLastRunExperiment(snapshot);
    const name = notebookName.trim() || `Experiment ${new Date().toLocaleString()}`;
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
  }

  function loadNotebookEntry(entry: NotebookEntry) {
    const snapshot = cloneExperiment(entry.experiment);
    setExperiment(snapshot);
    setSelectedPreset("custom");
    setResult(entry.result);
    setLastRunExperiment(snapshot);
    setCompareVisible(false);
  }

  function toggleCompare(id: string) {
    setCompareIds((previous) => {
      if (previous.includes(id)) return previous.filter((value) => value !== id);
      if (previous.length >= 2) return [previous[1], id];
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
    link.download = "elementlab-notebook.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearNotebook() {
    if (!window.confirm("Clear all saved bench runs?")) return;
    setNotebook([]);
    setCompareIds([]);
    setCompareVisible(false);
  }

  async function findMixes() {
    const pool =
      poolMode === "all"
        ? benchLibrary.map((ingredient) => ingredient.id)
        : experiment.parts.map((part) => part.id);
    if (pool.length === 0) {
      setOptimizerError("Add ingredients to your mix before using the selected-ingredients pool.");
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
      setOptimizerError("The search could not finish. Check the goal and try again.");
    } finally {
      setOptimizing(false);
    }
  }

  const comparison = compareIds
    .map((id) => notebook.find((entry) => entry.id === id))
    .filter((entry): entry is NotebookEntry => Boolean(entry));

  return (
    <main className="bench-page">
      <header className="bench-intro">
        <p className="bench-eyebrow">RULE-BASED MATERIALS SANDBOX</p>
        <h1>Experiment Bench</h1>
        <p>
          Mix proteins, enzymes, polymers, salts, and process conditions. Run a
          model, see what changed, or search for a better mix.
        </p>
      </header>

      <section className="bench-panel">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">01 · BUILD</p>
            <h2>Your mixture</h2>
          </div>
          <div className="bench-preset-control">
            <label htmlFor="bench-preset">Load a preset</label>
            <select
              className="select"
              id="bench-preset"
              value={selectedPreset}
              onChange={(event) => loadPreset(event.target.value)}
            >
              <option value="custom">Custom mix</option>
              {benchPresets.map((preset) => (
                <option value={preset.id} key={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bench-builder-grid">
          <section className="bench-subpanel" aria-labelledby="bench-library-heading">
            <div className="bench-subheading">
              <h3 id="bench-library-heading">Ingredient library</h3>
              <span>{visibleIngredients.length} items</span>
            </div>
            <div className="bench-filter-list" aria-label="Ingredient categories">
              {filterOptions.map((option) => (
                <button
                  className={`chip bench-chip${filter === option ? " is-active" : ""}`}
                  key={option}
                  type="button"
                  aria-pressed={filter === option}
                  onClick={() => setFilter(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <label className="bench-search-label" htmlFor="bench-search">
              Search ingredients
            </label>
            <input
              id="bench-search"
              className="input"
              type="search"
              placeholder="Try “calcium” or “silk”"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="bench-library-list">
              {visibleIngredients.map((ingredient) => {
                const added = experiment.parts.some((part) => part.id === ingredient.id);
                return (
                  <div className="bench-library-item" key={ingredient.id}>
                    <div className="bench-library-copy">
                      <strong>{ingredient.name}</strong>
                      <span>{ingredient.formula}</span>
                    </div>
                    <button
                      className="button button-secondary bench-add-button"
                      type="button"
                      disabled={added}
                      onClick={() => addIngredient(ingredient.id)}
                    >
                      {added ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
              {visibleIngredients.length === 0 && (
                <p className="bench-muted">No ingredients match that search.</p>
              )}
            </div>
          </section>

          <section className="bench-subpanel" aria-labelledby="bench-mix-heading">
            <div className="bench-subheading">
              <h3 id="bench-mix-heading">Mixing order</h3>
              <span className={Math.abs(totalPct - 100) > 0.1 ? "bench-total-warn" : ""}>
                {totalPct.toFixed(1)}%
              </span>
            </div>
            {experiment.parts.length === 0 ? (
              <div className="bench-empty">Add ingredients from the library to start a mix.</div>
            ) : (
              <div className="bench-mix-list">
                {experiment.parts.map((part, index) => {
                  const ingredient = benchById[part.id];
                  if (!ingredient) return null;
                  return (
                    <article className="bench-mix-row" key={`${part.id}-${index}`}>
                      <div className="bench-mix-row-top">
                        <div className="bench-mix-title">
                          <span className="bench-order">{String(index + 1).padStart(2, "0")}</span>
                          <strong>{ingredient.name}</strong>
                        </div>
                        <span className="badge bench-category-badge">{ingredient.category}</span>
                      </div>
                      <div className="bench-mix-controls">
                        <input
                          aria-label={`${ingredient.name} percentage slider`}
                          className="bench-range"
                          type="range"
                          min="0"
                          max="100"
                          step="0.5"
                          value={part.pct}
                          onChange={(event) => setPartPct(index, Number(event.target.value))}
                        />
                        <label className="bench-percent-field">
                          <span className="sr-only">{ingredient.name} percentage</span>
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
                          aria-label={`Move ${ingredient.name} up`}
                          type="button"
                          disabled={index === 0}
                          onClick={() => movePart(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="button button-secondary bench-icon-button"
                          aria-label={`Move ${ingredient.name} down`}
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
                        <summary>How it bonds / notes</summary>
                        <p>{ingredient.bonding}</p>
                        <p>{ingredient.notes}</p>
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
                Normalize to 100%
              </button>
              <p>Order matters for contact reactions.</p>
            </div>
          </section>
        </div>
      </section>

      <section className="bench-panel" aria-labelledby="bench-conditions-heading">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">02 · PROCESS</p>
            <h2 id="bench-conditions-heading">Conditions</h2>
          </div>
          <span className="bench-live-value">Effective pH {livePH.toFixed(2)}</span>
        </div>
        <div className="bench-condition-grid">
          <RangeNumberField
            label="Temperature"
            value={experiment.conditions.tempC}
            min={-20}
            max={200}
            step={1}
            unit="°C"
            onChange={(value) => setCondition("tempC", value)}
          />
          <RangeNumberField
            label="Set pH"
            value={experiment.conditions.pH}
            min={1}
            max={14}
            step={0.1}
            unit="pH"
            onChange={(value) => setCondition("pH", value)}
          />
          <RangeNumberField
            label="Pressure"
            value={experiment.conditions.pressureKPa}
            min={0.1}
            max={300}
            step={0.1}
            unit="kPa"
            onChange={(value) => setCondition("pressureKPa", value)}
          />
          <label className="bench-field">
            <span className="bench-field-label">Atmosphere</span>
            <select
              className="select"
              value={experiment.conditions.atmosphere}
              onChange={(event) =>
                setCondition("atmosphere", event.target.value as Conditions["atmosphere"])
              }
            >
              <option value="air">Air</option>
              <option value="nitrogen">Nitrogen</option>
              <option value="vacuum">Vacuum</option>
            </select>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">Humidity</span>
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
            <span className="bench-field-label">Mixing speed</span>
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
            <span className="bench-field-label">Mix time</span>
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
            <span className="bench-field-label">Cure time</span>
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
            <span className="bench-field-label">Forming method</span>
            <select
              className="select"
              value={experiment.conditions.forming}
              onChange={(event) =>
                setCondition("forming", event.target.value as Conditions["forming"])
              }
            >
              <option value="beaker">Beaker</option>
              <option value="extrude-air">Extrude into air</option>
              <option value="extrude-bath">Extrude into bath</option>
              <option value="cast-film">Cast film</option>
              <option value="heat-cure">Heat cure</option>
            </select>
          </label>
          {experiment.conditions.forming === "extrude-bath" && (
            <label className="bench-field">
              <span className="bench-field-label">Bath ingredient</span>
              <select
                className="select"
                value={experiment.conditions.bathId ?? ""}
                onChange={(event) => setCondition("bathId", event.target.value || undefined)}
              >
                <option value="">Choose a bath</option>
                {benchLibrary
                  .filter((ingredient) => ["salt", "solvent"].includes(ingredient.category))
                  .map((ingredient) => (
                    <option value={ingredient.id} key={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        <div className="bench-condition-chips">
          {[
            { label: "Vacuum 1 kPa", value: 1 },
            { label: "Room 101 kPa", value: 101 },
            { label: "Pressurized 200 kPa", value: 200 },
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
          Water boils at {waterBoilingPointC(experiment.conditions.pressureKPa).toFixed(1)} °C at
          this pressure. Set pH {experiment.conditions.pH.toFixed(1)} → effective pH{" "}
          {livePH.toFixed(1)}.
        </p>
      </section>

      <section className="bench-run-panel" aria-label="Run experiment">
        <label className="bench-run-name">
          <span>Notebook name (optional)</span>
          <input
            className="input"
            value={notebookName}
            placeholder="e.g. warm silk trial"
            onChange={(event) => setNotebookName(event.target.value)}
          />
        </label>
        <button className="button bench-run-button" type="button" onClick={() => runExperiment()}>
          Run experiment
        </button>
      </section>

      <section className="bench-panel" aria-labelledby="bench-results-heading">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">03 · RESULTS</p>
            <h2 id="bench-results-heading">What formed?</h2>
          </div>
          {changedSinceRun && <span className="bench-changed">Conditions changed — run again.</span>}
        </div>
        {!result ? (
          <div className="bench-empty">
            Results appear after you run an experiment. Your input changes are not simulated until Run.
          </div>
        ) : (
          <div className="bench-results">
            <div className={`bench-product bench-product-${result.product}`}>
              <div>
                <span className="bench-product-label">Estimated product</span>
                <h3>{result.productLabel}</h3>
                <p>{result.summary}</p>
              </div>
              <span className="bench-confidence">
                {result.confidence >= 0.8 ? "High" : result.confidence >= 0.5 ? "Medium" : "Low"}{" "}
                confidence · {Math.round(result.confidence * 100)}%
              </span>
            </div>
            <div className="bench-metric-grid">
              <Metric label="Tensile strength" value={formattedMechanicalValue(result, `${formatMPa(result.tensileMPa)} MPa`)} />
              <Metric label="Stretch" value={formattedMechanicalValue(result, `${formatPercent(result.elongationPct)}%`)} />
              <Metric label="Stickiness" value={formattedMechanicalValue(result, `${formatTack(result.tack)}/10`)} />
              <Metric label="Toughness" value={formattedMechanicalValue(result, `${formatToughness(result.toughnessMJm3)} MJ/m³`)} />
              <Metric label="Set time" value={showTime(result.setSeconds)} />
              <Metric label="Cost estimate" value={`$${formatCost(result.costPerKg)}/kg`} />
            </div>
            <div className="bench-safety-grid">
              <SafetyMetric label="Toxicity while mixing" value={hazardLabel(result.wetToxicity)} />
              <SafetyMetric label="Cured toxicity" value={hazardLabel(result.curedToxicity)} />
              <SafetyMetric label="Skin contact" value={hazardLabel(result.skin)} />
              <SafetyMetric label="Edible" value={result.edible ? "Yes" : "No"} />
              <SafetyMetric
                label="Water behavior"
                value={`${result.water} · ${result.dissolveTime}`}
              />
              <SafetyMetric label="Biodegradable" value={result.biodegradable ? "Yes" : "No"} />
            </div>
            <section className="bench-result-section">
              <h3>What happened</h3>
              {result.events.length === 0 ? (
                <p className="bench-muted">No modeled reaction rule matched this mix.</p>
              ) : (
                <div className="bench-event-list">
                  {result.events.map((event) => (
                    <article className={`bench-event bench-event-${event.status}`} key={event.id}>
                      <span className="bench-event-icon" aria-hidden="true">
                        {event.status === "happened" ? "✓" : event.status === "partial" ? "◐" : "×"}
                      </span>
                      <div>
                        <div className="bench-event-title">
                          <strong>{event.name}</strong>
                          <span>{event.status} · activity {event.activity.toFixed(2)}</span>
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
                <h3>Warnings and notes</h3>
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
              <h3>Not modelled</h3>
              {result.notModelled.length > 0 ? (
                <ul className="bench-unknown-list">
                  {result.notModelled.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p className="bench-muted">No unmodelled reactive interactions detected.</p>
              )}
              <p className="bench-confidence-note">
                Confidence is reduced for reactive ingredients without a modeled pairing. Unknown
                chemistry is not guessed.
              </p>
            </section>
          </div>
        )}
      </section>

      <section className="bench-panel" aria-labelledby="bench-optimizer-heading">
        <div className="bench-panel-heading">
          <div>
            <p className="bench-kicker">04 · SEARCH</p>
            <h2 id="bench-optimizer-heading">Find best mix</h2>
          </div>
          <span className="bench-live-value">Rule-based · seeded search</span>
        </div>
        <p className="bench-panel-copy">
          Set targets and the search will compare mixtures from the same rule-based model.
        </p>
        <div className="bench-goal-grid">
          <GoalNumberField
            label="Minimum tensile strength"
            value={goal.minTensileMPa}
            unit="MPa"
            onChange={(value) => setGoal({ ...goal, minTensileMPa: value })}
          />
          <GoalNumberField
            label="Minimum stretch"
            value={goal.minElongationPct}
            unit="%"
            onChange={(value) => setGoal({ ...goal, minElongationPct: value })}
          />
          <GoalNumberField
            label="Minimum stickiness"
            value={goal.minTack}
            unit="/10"
            onChange={(value) => setGoal({ ...goal, minTack: value })}
          />
          <GoalNumberField
            label="Maximum set time"
            value={goal.maxSetSeconds === undefined ? undefined : goal.maxSetSeconds / 60}
            unit="min"
            onChange={(value) =>
              setGoal({ ...goal, maxSetSeconds: value === undefined ? undefined : value * 60 })
            }
          />
          <GoalNumberField
            label="Maximum cost"
            value={goal.maxCostPerKg}
            unit="$/kg"
            onChange={(value) => setGoal({ ...goal, maxCostPerKg: value })}
          />
          <label className="bench-field">
            <span className="bench-field-label">Water behavior</span>
            <select
              className="select"
              value={goal.water ?? "any"}
              onChange={(event) =>
                setGoal({ ...goal, water: event.target.value as Goal["water"] })
              }
            >
              <option value="any">Any</option>
              <option value="resists">Resists</option>
              <option value="dissolves">Dissolves</option>
            </select>
          </label>
          <label className="bench-field">
            <span className="bench-field-label">Product type</span>
            <select
              className="select"
              value={goal.product ?? "any"}
              onChange={(event) =>
                setGoal({ ...goal, product: event.target.value as Goal["product"] })
              }
            >
              <option value="any">Any</option>
              <option value="fiber">Fiber</option>
              <option value="film">Film</option>
              <option value="gel">Gel</option>
              <option value="adhesive">Adhesive</option>
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
            <span>Skin-safe (skin and cured toxicity ≤ 1)</span>
          </label>
          <label className="bench-check">
            <input
              type="checkbox"
              checked={Boolean(goal.edible)}
              onChange={(event) => setGoal({ ...goal, edible: event.target.checked })}
            />
            <span>Edible</span>
          </label>
        </div>
        <fieldset className="bench-pool-options">
          <legend>Ingredient pool</legend>
          <label className="bench-check">
            <input
              type="radio"
              name="bench-pool"
              checked={poolMode === "all"}
              onChange={() => setPoolMode("all")}
            />
            <span>Whole library</span>
          </label>
          <label className="bench-check">
            <input
              type="radio"
              name="bench-pool"
              checked={poolMode === "selected"}
              onChange={() => setPoolMode("selected")}
            />
            <span>Only my selected ingredients ({experiment.parts.length})</span>
          </label>
        </fieldset>
        <div className="bench-search-options">
          <label className="bench-field bench-max-field">
            <span className="bench-field-label">Maximum ingredients</span>
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
            <span>Keep my current conditions</span>
          </label>
        </div>
        <div className="bench-search-actions">
          <button
            className="button bench-find-button"
            type="button"
            disabled={optimizing}
            onClick={() => void findMixes()}
          >
            {optimizing ? "Searching…" : "Find best mix"}
          </button>
          {searchTimeMs !== null && !optimizing && (
            <span className="bench-search-time">Finished in {searchTimeMs.toFixed(0)} ms</span>
          )}
        </div>
        {optimizing && (
          <div className="bench-progress" aria-live="polite">
            <progress max={progress.total || 2500} value={progress.completed} />
            <span>{progress.completed.toLocaleString()} / {progress.total.toLocaleString()} mixes checked</span>
          </div>
        )}
        {optimizerError && <p className="bench-inline-error">{optimizerError}</p>}
        {candidates.length > 0 && (
          <div className="bench-candidate-list">
            <h3>Top candidates</h3>
            {candidates.map((candidate, index) => (
              <article className="bench-candidate-card" key={`${candidate.experiment.parts.map((part) => part.id).sort().join("-")}-${index}`}>
                <div className="bench-candidate-head">
                  <span className="bench-rank">#{index + 1}</span>
                  <span className="badge bench-category-badge">{candidate.result.productLabel}</span>
                  <span className={`bench-target-status ${candidateTargetStatus(goal, candidate.result).met ? "is-met" : "is-missed"}`}>
                    {candidateTargetStatus(goal, candidate.result).label}
                  </span>
                </div>
                <p className="bench-candidate-parts">{partsSummary(candidate.experiment)}</p>
                <p className="bench-candidate-conditions">{conditionSummary(candidate.experiment.conditions)}</p>
                <div className="bench-candidate-metrics">
                  <span>{formattedMechanicalValue(candidate.result, `${formatMPa(candidate.result.tensileMPa)} MPa`)}</span>
                  <span>{formattedMechanicalValue(candidate.result, `${formatPercent(candidate.result.elongationPct)}% stretch`)}</span>
                  <span>{formattedMechanicalValue(candidate.result, `${formatTack(candidate.result.tack)}/10 tack`)}</span>
                  <span>{showTime(candidate.result.setSeconds)}</span>
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
                  Load into bench
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
          <span className="bench-live-value">{notebook.length} / 50 runs</span>
        </div>
        <div className="bench-notebook-actions">
          <button className="button button-secondary" type="button" disabled={!notebook.length} onClick={exportNotebook}>
            Export JSON
          </button>
          <button className="button button-secondary" type="button" disabled={!notebook.length} onClick={clearNotebook}>
            Clear notebook
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={compareIds.length !== 2}
            onClick={() => setCompareVisible(true)}
          >
            Compare selected ({compareIds.length}/2)
          </button>
        </div>
        {compareVisible && comparison.length === 2 && (
          <div className="bench-table-wrap">
            <table className="bench-compare-table">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>{comparison[0].name}</th>
                  <th>{comparison[1].name}</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Ingredients"
                  left={partsSummary(comparison[0].experiment)}
                  right={partsSummary(comparison[1].experiment)}
                />
                <CompareRow
                  label="Conditions"
                  left={conditionSummary(comparison[0].experiment.conditions)}
                  right={conditionSummary(comparison[1].experiment.conditions)}
                />
                <CompareRow label="Product" left={comparison[0].result.productLabel} right={comparison[1].result.productLabel} />
                <NumericCompareRow
                  label="Tensile (MPa)"
                  left={comparison[0].result.tensileMPa}
                  right={comparison[1].result.tensileMPa}
                  format={formatMPa}
                  leftSolid={!isNotSolid(comparison[0].result.product)}
                  rightSolid={!isNotSolid(comparison[1].result.product)}
                />
                <NumericCompareRow
                  label="Stretch (%)"
                  left={comparison[0].result.elongationPct}
                  right={comparison[1].result.elongationPct}
                  format={formatPercent}
                  leftSolid={!isNotSolid(comparison[0].result.product)}
                  rightSolid={!isNotSolid(comparison[1].result.product)}
                />
                <NumericCompareRow
                  label="Tack (/10)"
                  left={comparison[0].result.tack}
                  right={comparison[1].result.tack}
                  format={formatTack}
                  leftSolid={!isNotSolid(comparison[0].result.product)}
                  rightSolid={!isNotSolid(comparison[1].result.product)}
                />
                <NumericCompareRow
                  label="Toughness (MJ/m³)"
                  left={comparison[0].result.toughnessMJm3}
                  right={comparison[1].result.toughnessMJm3}
                  format={formatToughness}
                  leftSolid={!isNotSolid(comparison[0].result.product)}
                  rightSolid={!isNotSolid(comparison[1].result.product)}
                />
                <CompareRow
                  label="Set time"
                  left={showTime(comparison[0].result.setSeconds)}
                  right={showTime(comparison[1].result.setSeconds)}
                />
                <NumericCompareRow
                  label="Cost ($/kg)"
                  left={comparison[0].result.costPerKg}
                  right={comparison[1].result.costPerKg}
                  format={formatCost}
                />
                <CompareRow
                  label="Safety"
                  left={`Mix ${hazardLabel(comparison[0].result.wetToxicity)}, cured ${hazardLabel(comparison[0].result.curedToxicity)}, skin ${hazardLabel(comparison[0].result.skin)}`}
                  right={`Mix ${hazardLabel(comparison[1].result.wetToxicity)}, cured ${hazardLabel(comparison[1].result.curedToxicity)}, skin ${hazardLabel(comparison[1].result.skin)}`}
                />
              </tbody>
            </table>
          </div>
        )}
        {notebook.length === 0 ? (
          <div className="bench-empty">Each run is saved here automatically on this device.</div>
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
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  <span>
                    {entry.result.productLabel} · {formattedMechanicalValue(entry.result, `${formatMPa(entry.result.tensileMPa)} MPa`)} · {formattedMechanicalValue(entry.result, `${formatPercent(entry.result.elongationPct)}% stretch`)}
                  </span>
                  <small>{partsSummary(entry.experiment)}</small>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="bench-footer-note">
        Rule-based estimates from known chemistry. Unknown combinations are flagged, not guessed.
        Don&apos;t try risky mixes for real.
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bench-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SafetyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bench-safety">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CompareRow({
  label,
  left,
  right,
}: {
  label: string;
  left: string;
  right: string;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{left}</td>
      <td>{right}</td>
      <td>{left === right ? "No change" : "Changed"}</td>
    </tr>
  );
}

function NumericCompareRow({
  label,
  left,
  right,
  format,
  leftSolid = true,
  rightSolid = true,
}: {
  label: string;
  left: number;
  right: number;
  format: (value: number) => string;
  leftSolid?: boolean;
  rightSolid?: boolean;
}) {
  const delta = Math.round((right - left) * 100) / 100;
  const change =
    !leftSolid || !rightSolid
      ? "—"
      : `${delta > 0 ? "+" : ""}${format(delta)}`;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{leftSolid ? format(left) : "— (not a solid)"}</td>
      <td>{rightSolid ? format(right) : "— (not a solid)"}</td>
      <td>{change}</td>
    </tr>
  );
}
