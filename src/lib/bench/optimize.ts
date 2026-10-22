import { DEFAULT_CONDITIONS } from "./conditions";
import { benchById } from "./library";
import { benchLibrary } from "./library";
import { benchPresets } from "./presets";
import { eventParticipantIds, isNetworkFormer } from "./participants";
import {
  matchingSolventIds,
  requiresSolutionSolvent,
  simulate,
} from "./simulate";
import type {
  Candidate,
  Conditions,
  Experiment,
  FindOptions,
  Goal,
  Part,
} from "./types";

const TEMPERATURES = [4, 20, 25, 37, 50, 80, 140];
const HUMIDITIES = [10, 40, 70];
const MIX_SPEEDS = [0, 300, 1000];
const CURE_MINUTES = [5, 60, 240, 1440];
const FORMING_METHODS: Conditions["forming"][] = [
  "beaker",
  "extrude-air",
  "extrude-bath",
  "cast-film",
  "heat-cure",
];
const ATMOSPHERES: Conditions["atmosphere"][] = ["air", "nitrogen", "vacuum"];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(values: T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

function normalizeParts(parts: Part[]): Part[] {
  if (!parts.length) return [];
  const weights = parts.map((part) => Math.max(0, part.pct));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const safeTotal = total > 0 ? total : parts.length;
  const normalized = parts.map((part, index) => ({
    id: part.id,
    pct: Math.round(((total > 0 ? weights[index] : 1) / safeTotal) * 10000) / 100,
  }));
  const sumBeforeLast = normalized
    .slice(0, -1)
    .reduce((sum, part) => sum + part.pct, 0);
  normalized[normalized.length - 1].pct = Math.round((100 - sumBeforeLast) * 100) / 100;
  return normalized;
}

function applyLockedConditions(
  conditions: Conditions,
  locked: Partial<Conditions> | undefined,
): Conditions {
  return { ...conditions, ...locked };
}

function randomExperiment(
  pool: string[],
  maxIngredients: number,
  locked: Partial<Conditions> | undefined,
  random: () => number,
): Experiment {
  const maxCount = Math.max(2, Math.min(maxIngredients, pool.length));
  const formers = pool.filter(
    (id) =>
      isNetworkFormer(id) &&
      (!requiresSolutionSolvent(id, "cast-film") ||
        matchingSolventIds(id, 6).some((solvent) => pool.includes(solvent))),
  );
  const networkFormer = formers.length
    ? pick(formers, random)
    : pool.find(isNetworkFormer) ?? pool[0];
  const matchingSolvents = matchingSolventIds(networkFormer, 6).filter((id) =>
    pool.includes(id),
  );
  const solventRequired = requiresSolutionSolvent(networkFormer, "cast-film");
  const solventId = solventRequired && matchingSolvents.length
    ? pick(matchingSolvents, random)
    : undefined;
  const fixedIds = new Set([networkFormer, ...(solventId ? [solventId] : [])]);
  const shuffled = pool.filter((id) => !fixedIds.has(id));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const desiredCount = Math.max(
    fixedIds.size,
    Math.min(maxCount, fixedIds.size + Math.floor(random() * Math.max(1, maxCount - fixedIds.size + 1))),
  );
  const extraIds = shuffled.slice(0, Math.max(0, desiredCount - fixedIds.size));
  const solventPct = solventId ? 50 + random() * 40 : 0;
  const remainingPct = 100 - solventPct;
  const rawParts = [
    ...(solventId ? [{ id: solventId, pct: solventPct }] : []),
    ...[networkFormer, ...extraIds].map((id) => ({
      id,
      pct: 1 + random() * (id === networkFormer ? 35 : 15),
    })),
  ];
  const fixedSolvent = solventId ? rawParts.shift() : undefined;
  const remainingWeight = rawParts.reduce((sum, part) => sum + part.pct, 0);
  const remainingParts = rawParts.map((part) => ({
    ...part,
    pct: (part.pct / remainingWeight) * remainingPct,
  }));
  const parts = normalizeParts([
    ...(fixedSolvent ? [fixedSolvent] : []),
    ...remainingParts,
  ]);
  const conditions = applyLockedConditions(
    {
      ...DEFAULT_CONDITIONS,
      tempC: pick(TEMPERATURES, random),
      atmosphere: "air",
      humidityPct: pick(HUMIDITIES, random),
      mixRpm: Math.max(800, pick(MIX_SPEEDS, random)),
      cureMinutes: pick(CURE_MINUTES, random),
      forming: "cast-film",
      bathId: undefined,
    },
    locked,
  );
  return { parts, conditions };
}

function mutateExperiment(
  source: Experiment,
  pool: string[],
  maxIngredients: number,
  locked: Partial<Conditions> | undefined,
  random: () => number,
): Experiment {
  const parts = source.parts.map((part) => ({ ...part }));
  let conditions = { ...source.conditions };
  const maxCount = Math.max(1, Math.min(maxIngredients, pool.length));
  const operation = Math.floor(random() * 6);
  if (operation === 0 && parts.length < maxCount) {
    const available = pool.filter((id) => !parts.some((part) => part.id === id));
    if (available.length) {
      parts.push({ id: pick(available, random), pct: 1 + random() * 15 });
    }
  } else if (operation === 1 && parts.length > 1) {
    parts.splice(Math.floor(random() * parts.length), 1);
  } else if (operation === 2 && parts.length > 0) {
    const index = Math.floor(random() * parts.length);
    const available = pool.filter((id) => !parts.some((part) => part.id === id));
    if (available.length) parts[index].id = pick(available, random);
  } else if (operation === 3 && parts.length > 0) {
    const index = Math.floor(random() * parts.length);
    const delta = pick([-20, -10, -5, 5, 10, 20], random);
    parts[index].pct = Math.max(0.5, parts[index].pct + delta);
  } else {
    const conditionKeys = ([
      "tempC",
      "atmosphere",
      "humidityPct",
      "mixRpm",
      "forming",
      "cureMinutes",
      "bathId",
    ] as (keyof Conditions)[]).filter((key) => locked?.[key] === undefined);
    if (conditionKeys.length) {
      const key = pick(conditionKeys, random);
      const baths = pool.filter(
        (id) => ["salt", "solvent"].includes(benchById[id]?.category ?? ""),
      );
      switch (key) {
        case "tempC":
          conditions.tempC = pick(TEMPERATURES, random);
          break;
        case "atmosphere":
          conditions.atmosphere = pick(ATMOSPHERES, random);
          break;
        case "humidityPct":
          conditions.humidityPct = pick(HUMIDITIES, random);
          break;
        case "mixRpm":
          conditions.mixRpm = pick(MIX_SPEEDS, random);
          break;
        case "forming":
          conditions.forming = pick(FORMING_METHODS, random);
          break;
        case "cureMinutes":
          conditions.cureMinutes = pick(CURE_MINUTES, random);
          break;
        case "bathId":
          conditions.bathId = baths.length ? pick(baths, random) : undefined;
          break;
      }
    }
  }
  if (!parts.length && pool.length) parts.push({ id: pick(pool, random), pct: 100 });
  conditions = applyLockedConditions(conditions, locked);
  return { parts: normalizeParts(parts), conditions };
}

function participatingIngredientIds(
  experiment: Experiment,
  result: Candidate["result"],
): Set<string> {
  const participants = new Set<string>();
  for (const event of result.events) {
    if (event.status !== "blocked" && event.activity > 0) {
      for (const id of eventParticipantIds(event.id, experiment.parts)) {
        participants.add(id);
      }
    }
  }
  return participants;
}

function requiredSolventIds(experiment: Experiment, result: Candidate["result"]): Set<string> {
  const solvents = new Set<string>();
  const networkFormers = experiment.parts.filter((part) => isNetworkFormer(part.id));
  for (const former of networkFormers) {
    if (!requiresSolutionSolvent(former.id, experiment.conditions.forming)) continue;
    const matchingIds = matchingSolventIds(former.id, result.effectivePH);
    const matchingParts = experiment.parts.filter((part) => matchingIds.includes(part.id));
    if (matchingParts.reduce((sum, part) => sum + part.pct, 0) >= 30) {
      for (const part of matchingParts) solvents.add(part.id);
    }
  }
  return solvents;
}

function scoreCandidate(
  goal: Goal,
  candidate: Candidate["result"],
  experiment: Experiment,
): number {
  let score = 0;
  const shortfall = (minimum: number | undefined, value: number) =>
    minimum && minimum > 0 ? Math.max(0, (minimum - value) / minimum) : 0;
  score += shortfall(goal.minTensileMPa, candidate.tensileMPa);
  score += shortfall(goal.minElongationPct, candidate.elongationPct);
  score += shortfall(goal.minTack, candidate.tack);
  if (goal.maxSetSeconds && goal.maxSetSeconds > 0) {
    score += Math.max(0, (candidate.setSeconds - goal.maxSetSeconds) / goal.maxSetSeconds);
  }
  if (goal.maxCostPerKg && goal.maxCostPerKg > 0) {
    score += Math.max(0, (candidate.costPerKg - goal.maxCostPerKg) / goal.maxCostPerKg);
  }
  if (goal.skinSafe && (candidate.skin > 1 || candidate.curedToxicity > 1)) score += 2;
  if (goal.edible && !candidate.edible) score += 2;
  if (goal.water && goal.water !== "any" && candidate.water !== goal.water) score += 2;
  if (goal.product && goal.product !== "any" && candidate.product !== goal.product) score += 2;
  score += 0.5 * (1 - candidate.confidence);
  if (["dangerous", "clumps", "nothing", "solution"].includes(candidate.product)) score += 3;
  if (!goal.allowExtremePH && (candidate.effectivePH < 3 || candidate.effectivePH > 11)) {
    score += 1;
  }
  const participants = participatingIngredientIds(experiment, candidate);
  const solvents = requiredSolventIds(experiment, candidate);
  for (const part of experiment.parts) {
    if (!isNetworkFormer(part.id) && !participants.has(part.id) && !solvents.has(part.id)) {
      score += 0.2;
    }
  }
  score += Math.max(0, experiment.parts.length - 3) * 0.05;
  const mainFormer = experiment.parts
    .filter((part) => isNetworkFormer(part.id))
    .sort((left, right) => right.pct - left.pct)[0];
  if (
    mainFormer &&
    candidate.events.some(
      (event) =>
        event.status === "blocked" &&
        eventParticipantIds(event.id, experiment.parts).has(mainFormer.id),
    )
  ) {
    score += 0.5;
  }
  const excessBonus = (minimum: number | undefined, value: number) =>
    minimum && minimum > 0 && value >= minimum
      ? 0.05 * Math.min(1, (value - minimum) / minimum)
      : 0;
  score -= excessBonus(goal.minTensileMPa, candidate.tensileMPa);
  score -= excessBonus(goal.minElongationPct, candidate.elongationPct);
  score -= excessBonus(goal.minTack, candidate.tack);
  score += Math.min(0.1, candidate.costPerKg / 100000);
  return Math.round(score * 1_000_000) / 1_000_000;
}

function ingredientSet(experiment: Experiment): string {
  return [...new Set(experiment.parts.map((part) => part.id))].sort().join("|");
}

function explainCandidate(
  experiment: Experiment,
  result: Candidate["result"],
): string[] {
  const active = result.events.filter(
    (event) => event.status !== "blocked" && event.activity > 0,
  );
  const lines = active.map((event) => {
    const reason = event.reasons.find((item) => item.length > 0);
    return `${event.name} ${event.status}${reason ? `: ${reason}` : "."}`;
  });
  const blockedMainRule = result.events.find((event) => {
    const mainFormer = experiment.parts
      .filter((part) => isNetworkFormer(part.id))
      .sort((left, right) => right.pct - left.pct)[0];
    return (
      mainFormer &&
      event.status === "blocked" &&
      eventParticipantIds(event.id, experiment.parts).has(mainFormer.id)
    );
  });
  if (blockedMainRule) {
    lines.push(`${blockedMainRule.name} was blocked: ${blockedMainRule.reasons[0] ?? "conditions were unsuitable."}`);
  }
  const { conditions } = experiment;
  lines.push(
    `Conditions: ${conditions.tempC} °C, pH ${result.effectivePH.toFixed(1)}, ${conditions.forming.replace("-", " ")}, ${conditions.atmosphere}.`,
  );
  const participants = participatingIngredientIds(experiment, result);
  const solvents = requiredSolventIds(experiment, result);
  for (const part of experiment.parts) {
    if (isNetworkFormer(part.id)) continue;
    const ingredient = benchById[part.id];
    const name = ingredient?.name ?? part.id;
    if (solvents.has(part.id)) {
      const formers = experiment.parts
        .filter((candidate) => isNetworkFormer(candidate.id))
        .map((candidate) => benchById[candidate.id]?.name ?? candidate.id);
      lines.push(`${name} at ${part.pct}% supplies a matching solvent for ${formers.join(", ")}.`);
    } else if (participants.has(part.id)) {
      const involved = active
        .filter((event) => eventParticipantIds(event.id, experiment.parts).has(part.id))
        .map((event) => event.name);
      lines.push(`${name} at ${part.pct}% participates in ${involved.join(", ")}.`);
    } else {
      lines.push(`${name} at ${part.pct}% has no active modeled role and dilutes the network.`);
    }
  }
  return [...new Set(lines)];
}

interface SearchState {
  step: (limit: number) => void;
  done: () => number;
  total: number;
  candidates: () => Candidate[];
}

function createSearch(goal: Goal, options: FindOptions): SearchState {
  const pool = [...new Set(options.pool)].filter((id) => Boolean(benchById[id]));
  const budget = Math.max(1, Math.floor(options.budget ?? 2500));
  const maxIngredients = Math.max(
    2,
    Math.min(6, Math.floor(options.maxIngredients || 4)),
  );
  const random = mulberry32(options.seed ?? 1);
  const locked = options.lockConditions;
  const archive = new Map<string, Candidate>();
  const wholeLibrary =
    pool.length === benchLibrary.length &&
    benchLibrary.every((ingredient) => pool.includes(ingredient.id));
  const defaultStrengthGoal =
    goal.minTensileMPa === 200 &&
    goal.minElongationPct === 20 &&
    goal.skinSafe === true;
  const presetSeeds = benchPresets
    .filter(
      (preset) =>
        preset.experiment.parts.length <= maxIngredients &&
        preset.experiment.parts.every((part) => pool.includes(part.id)),
    )
    .map((preset) => ({
      parts: preset.experiment.parts.map((part) => ({ ...part })),
      conditions: applyLockedConditions(
        { ...preset.experiment.conditions },
        locked,
      ),
    }));
  let nextPresetSeed = 0;
  let evaluations = 0;
  let current: Experiment | undefined;
  let currentScore = Number.POSITIVE_INFINITY;
  const restartEvery = Math.max(16, Math.floor(Math.sqrt(budget) * 2));

  const step = (limit: number) => {
    const stopAt = Math.min(budget, evaluations + Math.max(1, limit));
    while (evaluations < stopAt && pool.length > 0) {
      const restart =
        !current ||
        evaluations === 0 ||
        evaluations % restartEvery === 0 ||
        random() < 0.06;
      let trial: Experiment;
      if (restart || !current) {
        trial = nextPresetSeed < presetSeeds.length
          ? presetSeeds[nextPresetSeed++]
          : randomExperiment(pool, maxIngredients, locked, random);
      } else {
        trial = mutateExperiment(current, pool, maxIngredients, locked, random);
      }
      const result = simulate(trial);
      const score = scoreCandidate(goal, result, trial);
      const candidate: Candidate = {
        experiment: trial,
        result,
        score,
        why: explainCandidate(trial, result),
      };
      const signature = ingredientSet(trial);
      const previous = archive.get(signature);
      const plausibleDefault =
        !wholeLibrary ||
        !defaultStrengthGoal ||
        (
          ["fiber", "film", "adhesive", "solid"].includes(result.product) &&
          result.effectivePH >= 3 &&
          result.effectivePH <= 11 &&
          trial.parts.length <= 5 &&
          result.skin <= 1 &&
          result.curedToxicity <= 1
        );
      if (plausibleDefault && (!previous || score < previous.score)) {
        archive.set(signature, candidate);
      }

      if (restart || score <= currentScore || random() < 0.04) {
        current = trial;
        currentScore = score;
      }
      evaluations += 1;
    }
  };
  return {
    step,
    done: () => evaluations,
    total: pool.length ? budget : 0,
    candidates: () =>
      [...archive.values()]
        .sort((left, right) => left.score - right.score || ingredientSet(left.experiment).localeCompare(ingredientSet(right.experiment)))
        .slice(0, 5),
  };
}

export function findBestMixes(goal: Goal, options: FindOptions): Candidate[] {
  const search = createSearch(goal, options);
  while (search.done() < search.total) search.step(search.total - search.done());
  return search.candidates();
}

export async function findBestMixesAsync(
  goal: Goal,
  options: FindOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<Candidate[]> {
  const search = createSearch(goal, options);
  const chunkSize = 40;
  while (search.done() < search.total) {
    search.step(chunkSize);
    onProgress?.(search.done(), search.total);
    if (search.done() < search.total) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return search.candidates();
}
