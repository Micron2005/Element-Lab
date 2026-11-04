import { fmtTime, hazardWord } from "../formula";
import { DEFAULT_LOCALE, tr, type Locale, type MessageKey } from "../i18n";
import { effectivePH } from "./conditions";
import { localizeBenchIngredient, benchById } from "./library";
import { localizeReactionEvent } from "./reactions";
import type { EventStatus, Experiment, Forming, Product, RunResult } from "./types";

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
  reactions: { id: string; name: string; statuses: (EventStatus | "absent")[]; changed: boolean }[];
  why: string[];
}

const CONDITION_LABEL_KEYS = [
  "bench.model.compare.condition.temperature",
  "bench.model.compare.condition.pressure",
  "bench.model.compare.condition.atmosphere",
  "bench.model.compare.condition.humidity",
  "bench.model.compare.condition.mixing",
  "bench.model.compare.condition.cure",
  "bench.model.compare.condition.forming",
  "bench.model.compare.condition.bath",
  "bench.model.compare.condition.derivedPH",
] as const satisfies readonly MessageKey[];

const FORMING_KEYS: Record<Forming, MessageKey> = {
  beaker: "bench.model.compare.forming.beaker",
  "extrude-air": "bench.model.compare.forming.extrudeAir",
  "extrude-bath": "bench.model.compare.forming.extrudeBath",
  "cast-film": "bench.model.compare.forming.castFilm",
  "heat-cure": "bench.model.compare.forming.heatCure",
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

export function reactionStatusLabel(
  status: EventStatus | "absent",
  locale: Locale = DEFAULT_LOCALE,
): string {
  return status === "absent"
    ? tr(locale, "bench.model.compare.status.absent")
    : tr(locale, `bench.reaction.status.${status}` as MessageKey);
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

function formatTime(seconds: number, locale: Locale): string {
  return seconds > 0 ? fmtTime(seconds, locale) : tr(locale, "bench.model.compare.noSet");
}

function formatHazard(value: number, locale: Locale): string {
  return tr(locale, `bench.custom.hazard.${hazardWord(value as 0 | 1 | 2 | 3)}` as MessageKey);
}

function maxHazard(result: RunResult): number {
  return Math.max(result.wetToxicity, result.curedToxicity, result.skin);
}

function conditionValues(input: CompareInput, locale: Locale): string[] {
  const { conditions } = input.experiment;
  const bathIngredient = conditions.bathId ? benchById[conditions.bathId] : undefined;
  const bath = bathIngredient
    ? localizeBenchIngredient(bathIngredient, locale).name
    : conditions.bathId ?? tr(locale, "bench.model.compare.none");
  const atmosphereKey = conditions.atmosphere === "air"
    ? "bench.model.compare.atmosphere.air"
    : conditions.atmosphere === "vacuum"
      ? "bench.model.compare.atmosphere.vacuum"
      : "bench.model.compare.atmosphere.nitrogen";
  return [
    `${conditions.tempC} °C`,
    `${conditions.pressureKPa} kPa`,
    tr(locale, atmosphereKey),
    `${conditions.humidityPct}%`,
    `${conditions.mixRpm} rpm × ${conditions.mixMinutes} min`,
    `${conditions.cureMinutes} min`,
    tr(locale, FORMING_KEYS[conditions.forming]),
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

function makeMeasures(runs: CompareInput[], locale: Locale): Comparison["measures"] {
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
    metric(tr(locale, "bench.model.compare.measure.product"), results.map(({ productLabel }) => productLabel)),
    metric(
      tr(locale, "bench.model.compare.measure.strength"),
      results.map((result) => isNotSolid(result.product) ? tr(locale, "bench.model.compare.notSolid") : `${formatMPa(result.tensileMPa)} MPa`),
      bestAmongSolids(results.map(({ tensileMPa }) => tensileMPa), "higher"),
      results.map(({ tensileMPa }) => tensileMPa),
      (value) => `${signed(value, 1)} MPa`,
      true,
    ),
    metric(
      tr(locale, "bench.model.compare.measure.stretch"),
      results.map((result) => isNotSolid(result.product) ? tr(locale, "bench.model.compare.notSolid") : `${Number(result.elongationPct.toFixed(1))}%`),
      bestAmongSolids(results.map(({ elongationPct }) => elongationPct), "higher"),
      results.map(({ elongationPct }) => elongationPct),
      (value) => `${signed(value, 1)}%`,
      true,
    ),
    metric(
      tr(locale, "bench.model.compare.measure.toughness"),
      results.map((result) => isNotSolid(result.product) ? tr(locale, "bench.model.compare.notSolid") : `${formatToughness(result.toughnessMJm3)} MJ/m³`),
      bestAmongSolids(results.map(({ toughnessMJm3 }) => toughnessMJm3), "higher"),
      results.map(({ toughnessMJm3 }) => toughnessMJm3),
      (value) => `${signed(value, 2)} MJ/m³`,
      true,
    ),
    metric(
      tr(locale, "bench.model.compare.measure.stickiness"),
      results.map(({ tack }) => `${tack.toFixed(1)}/10`),
      null,
      results.map(({ tack }) => tack),
      (value) => `${signed(value, 1)}/10`,
    ),
    metric(
      tr(locale, "bench.model.compare.measure.setTime"),
      results.map(({ setSeconds }) => formatTime(setSeconds, locale)),
      null,
      results.map(({ setSeconds }) => setSeconds),
      (value) => `${value < 0 ? "−" : "+"}${fmtTime(Math.abs(value))}`,
    ),
    metric(
      tr(locale, "bench.model.compare.measure.cost"),
      results.map(({ costPerKg }) => `$${formatCost(costPerKg)}/kg`),
      bestAmongSolids(results.map(({ costPerKg }) => costPerKg), "lower"),
      results.map(({ costPerKg }) => costPerKg),
      (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}$${formatCost(Math.abs(value))}/kg`,
    ),
    metric(
      tr(locale, "bench.model.compare.measure.safety"),
      results.map(({ wetToxicity, curedToxicity, skin }) =>
        tr(locale, "bench.model.compare.safetyValue", {
          wet: formatHazard(wetToxicity, locale),
          cured: formatHazard(curedToxicity, locale),
          skin: formatHazard(skin, locale),
        }),
      ),
      bestAmongSolids(results.map(maxHazard), "lower"),
      results.map(maxHazard),
      (value) => Math.abs(value) === 1
        ? tr(locale, "bench.model.compare.hazardLevel", { value: signed(value, 0) })
        : tr(locale, "bench.model.compare.hazardLevelPlural", { value: signed(value, 0) }),
    ),
    metric(
      tr(locale, "bench.model.compare.measure.confidence"),
      results.map(({ confidence }) => `${Math.round(confidence * 100)}%`),
      bestAmongSolids(results.map(({ confidence }) => confidence), "higher"),
      results.map(({ confidence }) => confidence * 100),
      (value) => tr(locale, "bench.model.compare.percentagePoints", { value: signed(value, 1) }),
    ),
  ];
}

function relativeChange(before: number, after: number): number {
  if (before === after) return 0;
  return before === 0 ? Number.POSITIVE_INFINITY : Math.abs((after - before) / before);
}

function runLabel(run: CompareInput, index: number, locale: Locale): string {
  const name = run.name.trim();
  return name && name.length <= 24
    ? name
    : tr(locale, "bench.model.compare.run", { name: String.fromCharCode(65 + index) });
}

const PRODUCT_LABEL_KEYS: Record<Product, MessageKey> = {
  nothing: "bench.model.product.nothing",
  solution: "bench.model.product.solution",
  gel: "bench.model.product.gel",
  slime: "bench.model.product.slime",
  fiber: "bench.model.product.fiber",
  film: "bench.model.product.film",
  adhesive: "bench.model.product.adhesive",
  solid: "bench.model.product.solid",
  clumps: "bench.model.product.clumps",
  dangerous: "bench.model.product.dangerous",
};

function productLabel(product: Product, locale: Locale): string {
  return tr(locale, PRODUCT_LABEL_KEYS[product]);
}

function makeWhy(
  runs: CompareInput[],
  ingredients: Comparison["ingredients"],
  conditions: Comparison["conditions"],
  reactions: Comparison["reactions"],
  locale: Locale,
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
    { label: tr(locale, "bench.model.compare.measure.strength"), values: runs.map(({ result }) => result.tensileMPa), unit: " MPa", solidOnly: true },
    { label: tr(locale, "bench.model.compare.measure.stretch"), values: runs.map(({ result }) => result.elongationPct), unit: "%" , solidOnly: true },
    { label: tr(locale, "bench.model.compare.measure.toughness"), values: runs.map(({ result }) => result.toughnessMJm3), unit: " MJ/m³", solidOnly: true },
    { label: tr(locale, "bench.model.compare.measure.stickiness"), values: runs.map(({ result }) => result.tack), unit: "/10" },
    { label: tr(locale, "bench.model.compare.measure.setTime"), values: runs.map(({ result }) => result.setSeconds), unit: " s" },
    { label: tr(locale, "bench.model.compare.measure.cost"), values: runs.map(({ result }) => result.costPerKg), unit: " $/kg" },
    { label: tr(locale, "bench.model.compare.measure.safetyShort"), values: runs.map(({ result }) => maxHazard(result)), unit: ` ${tr(locale, "bench.model.compare.hazardLevel", { value: "" }).trim()}` },
    { label: tr(locale, "bench.model.compare.measure.confidence"), values: runs.map(({ result }) => result.confidence * 100), unit: "%" },
  ];

  for (let index = 1; index < runs.length; index += 1) {
    const label = runLabel(runs[index], index, locale);
    for (const reaction of reactions) {
      if (!reaction.changed || reaction.statuses[index] === reaction.statuses[0]) continue;
      const currentEvent = runs[index].result.events.find((event) => event.id === reaction.id);
      const reason = currentEvent
        ? localizeReactionEvent(currentEvent, locale).reasons.join("; ")
        : "";
      why.push(tr(locale, "bench.model.compare.whyReaction", {
        run: label,
        reaction: reaction.name,
        before: reactionStatusLabel(reaction.statuses[0], locale),
        after: reactionStatusLabel(reaction.statuses[index], locale),
        reason: reason ? `, because ${reason}` : "",
      }));
    }

    for (const ingredient of ingredients) {
      const before = ingredientMaps[0].get(ingredient.id) ?? null;
      const after = ingredientMaps[index].get(ingredient.id) ?? null;
      if (before === after) continue;
      if (before === null && after !== null) {
        why.push(tr(locale, "bench.model.compare.whyAdds", { run: label, ingredient: ingredient.name, amount: formatPct(after) }));
      } else if (before !== null && after === null) {
        why.push(tr(locale, "bench.model.compare.whyRemoves", { run: label, ingredient: ingredient.name, amount: formatPct(before) }));
      } else if (before !== null && after !== null && Math.abs(after - before) >= 1) {
        why.push(
          tr(locale, "bench.model.compare.whyUses", {
            run: label,
            direction: tr(locale, after < before ? "bench.model.compare.direction.less" : "bench.model.compare.direction.more"),
            ingredient: ingredient.name,
            before: formatPct(before),
            after: formatPct(after),
          }),
        );
      }
    }

    for (const condition of conditions) {
      if (!condition.changed || condition.values[index] === condition.values[0]) continue;
      why.push(tr(locale, "bench.model.compare.whyCondition", {
        run: label, condition: condition.label, before: condition.values[0], after: condition.values[index],
      }));
    }

    if (base.result.product !== runs[index].result.product) {
      why.push(tr(locale, "bench.model.compare.whyProduct", {
        run: label,
        before: productLabel(base.result.product, locale),
        after: productLabel(runs[index].result.product, locale),
      }));
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
        if (measure.label === tr(locale, "bench.model.compare.measure.strength")) return `${formatMPa(value)}${measure.unit}`;
        if (measure.label === tr(locale, "bench.model.compare.measure.stretch")) return `${Number(value.toFixed(1))}${measure.unit}`;
        if (measure.label === tr(locale, "bench.model.compare.measure.toughness")) return `${formatToughness(value)}${measure.unit}`;
        if (measure.label === tr(locale, "bench.model.compare.measure.stickiness")) return `${value.toFixed(1)}${measure.unit}`;
        if (measure.label === tr(locale, "bench.model.compare.measure.setTime")) return formatTime(value, locale);
        if (measure.label === tr(locale, "bench.model.compare.measure.cost")) return `$${formatCost(value)}/kg`;
        if (measure.label === tr(locale, "bench.model.compare.measure.safetyShort")) return `${formatHazard(value, locale)}${measure.unit}`;
        return `${Math.round(value)}${measure.unit}`;
      };
      why.push(tr(locale, "bench.model.compare.whyMeasure", {
        run: label, measure: measure.label, before: render(before), after: render(after),
      }));
    }
  }

  return why.length ? why : [tr(locale, "bench.model.compare.noDifferences")];
}

export function compareRuns(
  runs: CompareInput[],
  locale: Locale = DEFAULT_LOCALE,
): Comparison {
  if (runs.length < 2 || runs.length > 3) {
    throw new Error(tr(locale, "bench.model.compare.countError"));
  }

  const ingredientIds = [...new Set(runs.flatMap(({ experiment }) => experiment.parts.map(({ id }) => id)))];
  const ingredients = ingredientIds.map((id) => {
    const pcts = runs.map(({ experiment }) => {
      const parts = experiment.parts.filter((part) => part.id === id);
      return parts.length ? parts.reduce((sum, part) => sum + part.pct, 0) : null;
    });
    return {
      id,
      name: benchById[id] ? localizeBenchIngredient(benchById[id], locale).name : id,
      pcts,
      changed: pcts.some((value) => value !== pcts[0]),
    };
  });

  const conditionRows = runs.map((run) => conditionValues(run, locale));
  const conditions = CONDITION_LABEL_KEYS.map((key, index) => {
    const label = tr(locale, key);
    const values = conditionRows.map((row) => row[index]);
    return { label, values, changed: values.some((value) => value !== values[0]) };
  });

  const reactionIds = [...new Set(runs.flatMap(({ result }) => result.events.map(({ id }) => id)))];
  const reactions = reactionIds.map((id) => {
    const events = runs.map(({ result }) => result.events.find((event) => event.id === id));
    const statuses = events.map((event) => event?.status ?? "absent");
    return {
      id,
      name: events.find((event) => event)
        ? localizeReactionEvent(events.find((event) => event)!, locale).name
        : id,
      statuses,
      changed: statuses.some((status) => status !== statuses[0]),
    };
  });

  const measures = makeMeasures(runs, locale);
  const why = makeWhy(runs, ingredients, conditions, reactions, locale);

  return {
    names: runs.map(({ name }) => name),
    ingredients,
    conditions,
    measures,
    reactions,
    why,
  };
}
