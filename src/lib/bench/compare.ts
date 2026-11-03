import { fmtTime, hazardWord } from "../formula";
import { effectivePH } from "./conditions";
import { benchById } from "./library";
import type { EventStatus, Experiment, Forming, RunResult } from "./types";

export interface CompareInput {
  name: string;
  experiment: Experiment;
  result: RunResult;
}

export interface Comparison {
  names: string[];
  ingredients: { id: string; name: string; pcts: (number | null)[]; changed: boolean }[];
  conditions: { label: string; values: string[]; changed: boolean }[];
  measures: { label: string; values: string[]; best: number | null; deltas: string[] }[];
  reactions: { name: string; statuses: (EventStatus | "absent")[]; changed: boolean }[];
  why: string[];
}

const CONDITION_LABELS = [
  "Temperature",
  "Pressure",
  "Atmosphere",
  "Humidity",
  "Mixing",
  "Cure",
  "Forming",
  "Bath",
  "pH (derived)",
];

const FORMING_LABELS: Record<Forming, string> = {
  beaker: "Beaker",
  "extrude-air": "Extrude into air",
  "extrude-bath": "Extrude into bath",
  "cast-film": "Cast film",
  "heat-cure": "Heat cure",
};

const NON_SOLID_PRODUCTS: RunResult["product"][] = [
  "solution",
  "nothing",
  "clumps",
  "dangerous",
];

export function isNotSolid(product: RunResult["product"]): boolean {
  return NON_SOLID_PRODUCTS.includes(product);
}

export function reactionStatusLabel(status: EventStatus | "absent"): string {
  return status === "absent" ? "not possible (an ingredient is missing)" : status;
}

function formatPct(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(1))}%`;
}

function formatMPa(value: number): string {
  return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
}

function formatToughness(value: number): string {
  return Number(value.toPrecision(2)).toString();
}

function formatCost(value: number): string {
  return value < 10 && value > -10 ? value.toFixed(2) : Math.round(value).toString();
}

function formatTime(seconds: number): string {
  return seconds > 0 ? fmtTime(seconds) : "Doesn't set on its own";
}

function formatHazard(value: number): string {
  return hazardWord(value as 0 | 1 | 2 | 3);
}

function maxHazard(result: RunResult): number {
  return Math.max(result.wetToxicity, result.curedToxicity, result.skin);
}

function conditionValues(input: CompareInput): string[] {
  const { conditions } = input.experiment;
  const bath = conditions.bathId
    ? benchById[conditions.bathId]?.name ?? conditions.bathId
    : "None";
  return [
    `${conditions.tempC} °C`,
    `${conditions.pressureKPa} kPa`,
    conditions.atmosphere,
    `${conditions.humidityPct}%`,
    `${conditions.mixRpm} rpm × ${conditions.mixMinutes} min`,
    `${conditions.cureMinutes} min`,
    FORMING_LABELS[conditions.forming],
    bath,
    effectivePH(input.experiment).toFixed(1),
  ];
}

function bestIndex(
  values: number[],
  direction: "higher" | "lower",
  candidateIndices: number[],
): number | null {
  if (candidateIndices.length < 2) return null;
  const candidates = candidateIndices.map((index) => values[index]);
  const bestValue = direction === "higher" ? Math.max(...candidates) : Math.min(...candidates);
  const matches = candidateIndices.filter((index) => values[index] === bestValue);
  return matches.length === 1 ? matches[0] : null;
}

function signed(value: number, decimals: number): string {
  const formatted = value.toFixed(decimals);
  return value > 0 ? `+${formatted}` : formatted;
}

function makeMeasures(runs: CompareInput[]): Comparison["measures"] {
  const results = runs.map(({ result }) => result);
  const solidIndices = results.flatMap(({ product }, index) => isNotSolid(product) ? [] : [index]);
  const bestAmongSolids = (values: number[], direction: "higher" | "lower") =>
    bestIndex(values, direction, solidIndices);
  const first = results[0];
  const metric = (
    label: string,
    values: string[],
    best: number | null = null,
    numbers?: number[],
    delta: (value: number) => string = (value) => signed(value, 1),
    requireSolid = false,
  ): Comparison["measures"][number] => ({
    label,
    values,
    best,
    deltas: runs.map((run, index) => {
      if (index === 0 || !numbers || (requireSolid && (isNotSolid(first.product) || isNotSolid(run.result.product)))) {
        return "—";
      }
      return delta(numbers[index] - numbers[0]);
    }),
  });

  return [
    metric("Product", results.map(({ productLabel }) => productLabel)),
    metric(
      "Strength",
      results.map((result) => isNotSolid(result.product) ? "— (not a solid)" : `${formatMPa(result.tensileMPa)} MPa`),
      bestAmongSolids(results.map(({ tensileMPa }) => tensileMPa), "higher"),
      results.map(({ tensileMPa }) => tensileMPa),
      (value) => `${signed(value, 1)} MPa`,
      true,
    ),
    metric(
      "Stretch",
      results.map((result) => isNotSolid(result.product) ? "— (not a solid)" : `${Number(result.elongationPct.toFixed(1))}%`),
      bestAmongSolids(results.map(({ elongationPct }) => elongationPct), "higher"),
      results.map(({ elongationPct }) => elongationPct),
      (value) => `${signed(value, 1)}%`,
      true,
    ),
    metric(
      "Toughness",
      results.map((result) => isNotSolid(result.product) ? "— (not a solid)" : `${formatToughness(result.toughnessMJm3)} MJ/m³`),
      bestAmongSolids(results.map(({ toughnessMJm3 }) => toughnessMJm3), "higher"),
      results.map(({ toughnessMJm3 }) => toughnessMJm3),
      (value) => `${signed(value, 2)} MJ/m³`,
      true,
    ),
    metric(
      "Stickiness",
      results.map(({ tack }) => `${tack.toFixed(1)}/10`),
      null,
      results.map(({ tack }) => tack),
      (value) => `${signed(value, 1)}/10`,
    ),
    metric(
      "Set time",
      results.map(({ setSeconds }) => formatTime(setSeconds)),
      null,
      results.map(({ setSeconds }) => setSeconds),
      (value) => `${value < 0 ? "−" : "+"}${fmtTime(Math.abs(value))}`,
    ),
    metric(
      "Cost",
      results.map(({ costPerKg }) => `$${formatCost(costPerKg)}/kg`),
      bestAmongSolids(results.map(({ costPerKg }) => costPerKg), "lower"),
      results.map(({ costPerKg }) => costPerKg),
      (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}$${formatCost(Math.abs(value))}/kg`,
    ),
    metric(
      "Safety (wet / cured / skin)",
      results.map(({ wetToxicity, curedToxicity, skin }) =>
        `Wet ${formatHazard(wetToxicity)} · cured ${formatHazard(curedToxicity)} · skin ${formatHazard(skin)}`,
      ),
      bestAmongSolids(results.map(maxHazard), "lower"),
      results.map(maxHazard),
      (value) => `${signed(value, 0)} hazard level${Math.abs(value) === 1 ? "" : "s"}`,
    ),
    metric(
      "Confidence",
      results.map(({ confidence }) => `${Math.round(confidence * 100)}%`),
      bestAmongSolids(results.map(({ confidence }) => confidence), "higher"),
      results.map(({ confidence }) => confidence * 100),
      (value) => `${signed(value, 1)} percentage points`,
    ),
  ];
}

function relativeChange(before: number, after: number): number {
  if (before === after) return 0;
  return before === 0 ? Number.POSITIVE_INFINITY : Math.abs((after - before) / before);
}

function runLabel(run: CompareInput, index: number): string {
  const name = run.name.trim();
  return name && name.length <= 24 ? name : `Run ${String.fromCharCode(65 + index)}`;
}

function makeWhy(
  runs: CompareInput[],
  ingredients: Comparison["ingredients"],
  conditions: Comparison["conditions"],
  reactions: Comparison["reactions"],
): string[] {
  const why: string[] = [];
  const base = runs[0];
  const ingredientMaps = runs.map((run) => {
    const amounts = new Map<string, number>();
    for (const part of run.experiment.parts) {
      amounts.set(part.id, (amounts.get(part.id) ?? 0) + part.pct);
    }
    return amounts;
  });
  const runMeasures: { label: string; values: number[]; unit: string; solidOnly?: boolean }[] = [
    { label: "Strength", values: runs.map(({ result }) => result.tensileMPa), unit: " MPa", solidOnly: true },
    { label: "Stretch", values: runs.map(({ result }) => result.elongationPct), unit: "%" , solidOnly: true },
    { label: "Toughness", values: runs.map(({ result }) => result.toughnessMJm3), unit: " MJ/m³", solidOnly: true },
    { label: "Stickiness", values: runs.map(({ result }) => result.tack), unit: "/10" },
    { label: "Set time", values: runs.map(({ result }) => result.setSeconds), unit: " s" },
    { label: "Cost", values: runs.map(({ result }) => result.costPerKg), unit: " $/kg" },
    { label: "Safety", values: runs.map(({ result }) => maxHazard(result)), unit: " hazard level" },
    { label: "Confidence", values: runs.map(({ result }) => result.confidence * 100), unit: "%" },
  ];

  for (let index = 1; index < runs.length; index += 1) {
    const label = runLabel(runs[index], index);
    for (const reaction of reactions) {
      if (!reaction.changed || reaction.statuses[index] === reaction.statuses[0]) continue;
      const currentEvent = runs[index].result.events.find((event) => event.name === reaction.name);
      const reason = currentEvent?.reasons.join("; ");
      why.push(
        `${label}: ${reaction.name} went from ${reactionStatusLabel(reaction.statuses[0])} to ${reactionStatusLabel(reaction.statuses[index])}${reason ? `, because ${reason}` : ""}.`,
      );
    }

    for (const ingredient of ingredients) {
      const before = ingredientMaps[0].get(ingredient.id) ?? null;
      const after = ingredientMaps[index].get(ingredient.id) ?? null;
      if (before === after) continue;
      if (before === null && after !== null) {
        why.push(`${label} adds ${ingredient.name} (${formatPct(after)}).`);
      } else if (before !== null && after === null) {
        why.push(`${label} removes ${ingredient.name} (${formatPct(before)}).`);
      } else if (before !== null && after !== null && Math.abs(after - before) >= 1) {
        why.push(
          `${label} uses ${after < before ? "less" : "more"} ${ingredient.name} (${formatPct(before)} → ${formatPct(after)}).`,
        );
      }
    }

    for (const condition of conditions) {
      if (!condition.changed || condition.values[index] === condition.values[0]) continue;
      why.push(`${label} changes ${condition.label} (${condition.values[0]} → ${condition.values[index]}).`);
    }

    if (base.result.productLabel !== runs[index].result.productLabel) {
      why.push(`${label}: Product ${base.result.productLabel} → ${runs[index].result.productLabel}.`);
    }

    const largest = runMeasures
      .filter(({ values, solidOnly }) =>
        values[index] !== values[0] &&
        (!solidOnly || (!isNotSolid(base.result.product) && !isNotSolid(runs[index].result.product))),
      )
      .sort((left, right) => {
        const leftChange = relativeChange(left.values[0], left.values[index]);
        const rightChange = relativeChange(right.values[0], right.values[index]);
        return rightChange === leftChange ? 0 : rightChange > leftChange ? 1 : -1;
      })
      .slice(0, 2);
    for (const measure of largest) {
      const before = measure.values[0];
      const after = measure.values[index];
      const render = (value: number) => {
        if (measure.label === "Strength") return `${formatMPa(value)}${measure.unit}`;
        if (measure.label === "Stretch") return `${Number(value.toFixed(1))}${measure.unit}`;
        if (measure.label === "Toughness") return `${formatToughness(value)}${measure.unit}`;
        if (measure.label === "Stickiness") return `${value.toFixed(1)}${measure.unit}`;
        if (measure.label === "Set time") return formatTime(value);
        if (measure.label === "Cost") return `$${formatCost(value)}/kg`;
        if (measure.label === "Safety") return `${formatHazard(value)}${measure.unit}`;
        return `${Math.round(value)}${measure.unit}`;
      };
      why.push(`${label}: ${measure.label} ${render(before)} → ${render(after)}.`);
    }
  }

  return why.length ? why : ["No differences: same ingredients and conditions."];
}

export function compareRuns(runs: CompareInput[]): Comparison {
  if (runs.length < 2 || runs.length > 3) {
    throw new Error("Compare exactly two or three runs.");
  }

  const ingredientIds = [...new Set(runs.flatMap(({ experiment }) => experiment.parts.map(({ id }) => id)))];
  const ingredients = ingredientIds.map((id) => {
    const pcts = runs.map(({ experiment }) => {
      const parts = experiment.parts.filter((part) => part.id === id);
      return parts.length ? parts.reduce((sum, part) => sum + part.pct, 0) : null;
    });
    return {
      id,
      name: benchById[id]?.name ?? id,
      pcts,
      changed: pcts.some((value) => value !== pcts[0]),
    };
  });

  const conditionRows = runs.map(conditionValues);
  const conditions = CONDITION_LABELS.map((label, index) => {
    const values = conditionRows.map((row) => row[index]);
    return { label, values, changed: values.some((value) => value !== values[0]) };
  });

  const reactionIds = [...new Set(runs.flatMap(({ result }) => result.events.map(({ id }) => id)))];
  const reactions = reactionIds.map((id) => {
    const events = runs.map(({ result }) => result.events.find((event) => event.id === id));
    const statuses = events.map((event) => event?.status ?? "absent");
    return {
      name: events.find((event) => event)?.name ?? id,
      statuses,
      changed: statuses.some((status) => status !== statuses[0]),
    };
  });

  const measures = makeMeasures(runs);
  const why = makeWhy(runs, ingredients, conditions, reactions);

  return {
    names: runs.map(({ name }) => name),
    ingredients,
    conditions,
    measures,
    reactions,
    why,
  };
}
