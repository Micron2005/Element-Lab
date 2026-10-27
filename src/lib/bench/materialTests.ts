import { fmtTime } from "../formula";
import { CUSTOM_PREFIX } from "./custom";
import { benchById } from "./library";
import { fluidFromMix } from "./shootTest";
import type { BenchIngredient, Experiment, RunResult } from "./types";

export type TestTone = "good" | "warn" | "bad";

export interface TestReport<V extends string> {
  verdict: V;
  tone: TestTone;
  headline: string;
  notes: string[];
  metrics: { label: string; value: string }[];
  confidence: number;
}

interface PresentIngredient {
  ingredient: BenchIngredient;
  pct: number;
}

function presentIngredients(experiment: Experiment): PresentIngredient[] {
  const amounts = new Map<string, number>();
  for (const part of experiment.parts) {
    if (part.pct > 0 && Number.isFinite(part.pct)) {
      amounts.set(part.id, (amounts.get(part.id) ?? 0) + part.pct);
    }
  }
  return [...amounts].flatMap(([id, pct]) => {
    const ingredient = benchById[id];
    return ingredient ? [{ ingredient, pct }] : [];
  });
}

function percentWithTag(parts: PresentIngredient[], tag: string): number {
  return parts.reduce(
    (sum, part) => sum + (part.ingredient.tags.includes(tag as never) ? part.pct : 0),
    0,
  );
}

function activeEvents(result: RunResult): Set<string> {
  return new Set(result.events.filter((event) => event.activity > 0).map((event) => event.id));
}

function displayNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toPrecision(digits)).toLocaleString("en-US");
}

function unsafeReport<V extends string>(confidence: number): TestReport<V> {
  return {
    verdict: "unsafe" as V,
    tone: "bad",
    headline: "Unsafe mix; the model won't run this test.",
    notes: [],
    metrics: [],
    confidence,
  };
}

export type StretchVerdict =
  | "breaks"
  | "snaps"
  | "flows"
  | "nothing-to-test"
  | "falls-apart"
  | "unsafe";

export interface StretchSetup {
  diameterMm: number;
  lengthMm: number;
  pullMmPerMin: number;
}

export const DEFAULT_STRETCH: StretchSetup = {
  diameterMm: 1,
  lengthMm: 100,
  pullMmPerMin: 100,
};

export interface StressPoint {
  strainPct: number;
  stressMPa: number;
}

export interface StretchReport extends TestReport<StretchVerdict> {
  curve: StressPoint[];
  holdsKg: number | null;
  breakLengthMm: number | null;
  energyJ: number | null;
  strengthMPa: number;
  elongationPct: number;
  flows: boolean;
}

function emptyStretch(
  verdict: "nothing-to-test" | "falls-apart" | "unsafe",
  headline: string,
  confidence: number,
): StretchReport {
  return {
    verdict,
    tone: verdict === "unsafe" || verdict === "falls-apart" ? "bad" : "warn",
    headline,
    notes: [],
    metrics: [
      { label: "Breaking force", value: "— N" },
      { label: "Holds", value: "— kg" },
      { label: "Length at break", value: "— mm" },
      { label: "Energy to break", value: "— J" },
    ],
    confidence,
    curve: [],
    holdsKg: null,
    breakLengthMm: null,
    energyJ: null,
    strengthMPa: 0,
    elongationPct: 0,
    flows: false,
  };
}

export function stretchTest(
  experiment: Experiment,
  result: RunResult,
  setup: StretchSetup,
): StretchReport {
  if (result.product === "dangerous") {
    return emptyStretch(
      "unsafe",
      "Unsafe mix; the model won't run this test.",
      result.confidence,
    );
  }
  if (result.product === "solution" || result.product === "nothing") {
    return emptyStretch(
      "nothing-to-test",
      "There's no solid to pull; it's a liquid mix.",
      result.confidence,
    );
  }
  if (result.product === "clumps") {
    return emptyStretch(
      "falls-apart",
      "Clumps crumble instead of stretching.",
      result.confidence,
    );
  }

  const parts = presentIngredients(experiment);
  const strainRate = (setup.pullMmPerMin / 60) / setup.lengthMm;
  const flows = result.product === "slime" && strainRate < 0.1;
  const snaps = result.product === "slime" && !flows;
  const strengthMPa = flows ? result.tensileMPa * 0.2 : result.tensileMPa;
  const elongationPct = flows
    ? Math.max(result.elongationPct, 500)
    : snaps
      ? Math.min(result.elongationPct, 100)
      : result.elongationPct;
  const areaM2 = Math.PI * (setup.diameterMm / 2000) ** 2;
  const breakN = strengthMPa * 1e6 * areaM2;
  const holdsKg = breakN / 9.81;
  const breakLengthMm = setup.lengthMm * (1 + elongationPct / 100);
  const energyJ =
    0.5 *
    strengthMPa *
    1e6 *
    (elongationPct / 100) *
    areaM2 *
    (setup.lengthMm / 1000);
  const rubbery =
    result.elongationPct >= 200 || percentWithTag(parts, "elastomer") >= 10;
  const curve: StressPoint[] = Array.from({ length: 21 }, (_, index) => {
    const x = index / 20;
    const stressShape = rubbery
      ? x ** 2
      : flows
        ? 4 * x * (1 - x)
        : 1 - (1 - x) ** 2;
    return {
      strainPct: elongationPct * x,
      stressMPa: strengthMPa * stressShape,
    };
  });
  const notes: string[] = [];
  if (rubbery) notes.push("Snaps back close to its length when released (rubbery).");
  if (result.elongationPct < 5) notes.push("Brittle: barely stretches before snapping.");
  const verdict: StretchVerdict = flows ? "flows" : snaps ? "snaps" : "breaks";
  const headline = flows
    ? "Pulled slowly, the slime flows and thins out before it breaks."
    : snaps
      ? "Pulled fast, the slime snaps like a solid."
      : `Breaks at ${displayNumber(breakN)} N after stretching ${displayNumber(elongationPct, 3)}%.`;
  return {
    verdict,
    tone: flows || snaps ? "warn" : "good",
    headline,
    notes,
    metrics: [
      { label: "Breaking force", value: `${displayNumber(breakN)} N` },
      { label: "Holds", value: `${displayNumber(holdsKg)} kg` },
      { label: "Length at break", value: `${displayNumber(breakLengthMm)} mm` },
      { label: "Energy to break", value: `${displayNumber(energyJ)} J` },
    ],
    confidence: result.confidence,
    curve,
    holdsKg,
    breakLengthMm,
    energyJ,
    strengthMPa,
    elongationPct,
    flows,
  };
}

export type HeatKind =
  | "evaporate"
  | "soften"
  | "denature"
  | "melt"
  | "gas"
  | "decompose"
  | "burn";

export interface HeatEvent {
  tempC: number;
  text: string;
  kind: HeatKind;
  reversible: boolean;
}

type ThermalEntry = Omit<HeatEvent, "reversible"> & { reversible?: boolean };

const THERMAL: Record<string, ThermalEntry[]> = {
  pva: [{ tempC: 200, kind: "decompose", text: "PVA starts to break down and brown." }],
  alginate: [{ tempC: 200, kind: "decompose", text: "Alginate breaks down and chars." }],
  "hyaluronic-acid": [{ tempC: 200, kind: "decompose", text: "Hyaluronic acid breaks down." }],
  chitosan: [{ tempC: 250, kind: "decompose", text: "Chitosan breaks down and chars." }],
  pu: [{ tempC: 250, kind: "decompose", text: "Polyurethane breaks down." }],
  latex: [{ tempC: 300, kind: "decompose", text: "Rubber breaks down." }],
  pib: [{ tempC: 300, kind: "decompose", text: "Polyisobutylene breaks down." }],
  nylon66: [
    { tempC: 265, kind: "melt", text: "Nylon 6,6 melts." },
    { tempC: 350, kind: "decompose", text: "Nylon breaks down." },
  ],
  cyanoacrylate: [
    { tempC: 80, kind: "soften", text: "Cured superglue softens and loses grip." },
    { tempC: 200, kind: "decompose", text: "Cured superglue breaks down." },
  ],
  cnf: [{ tempC: 280, kind: "decompose", text: "Cellulose nanofibers char." }],
  glycerol: [{ tempC: 290, kind: "evaporate", text: "Glycerol boils off and starts to break down." }],
  sulfur: [{ tempC: 115, kind: "melt", text: "Sulfur melts." }],
  "sodium-bicarbonate": [{ tempC: 80, kind: "gas", text: "Baking soda breaks down and gives off CO₂ gas." }],
  "citric-acid": [{ tempC: 175, kind: "decompose", text: "Citric acid breaks down." }],
  "acetic-acid": [{ tempC: 118, kind: "evaporate", text: "Acetic acid boils off (sharp vinegar smell)." }],
  "formic-acid": [{ tempC: 101, kind: "evaporate", text: "Formic acid boils off." }],
  "hydrogen-peroxide": [{ tempC: 50, kind: "gas", text: "Hydrogen peroxide breaks down faster into oxygen and water." }],
  fecl3: [{ tempC: 306, kind: "melt", text: "Iron(III) chloride melts." }],
  caco3: [{ tempC: 825, kind: "gas", text: "Calcium carbonate breaks down and gives off CO₂." }],
  cacl2: [{ tempC: 772, kind: "melt", text: "Calcium chloride melts." }],
  nacl: [{ tempC: 801, kind: "melt", text: "Salt melts." }],
  kcl: [{ tempC: 770, kind: "melt", text: "Potassium chloride melts." }],
  graphene: [{ tempC: 550, kind: "decompose", text: "Graphene starts to oxidize in air." }],
  cnt: [{ tempC: 550, kind: "decompose", text: "Carbon nanotubes start to oxidize in air." }],
};

export type HeatVerdict =
  | "stable"
  | "dries-out"
  | "softens"
  | "melts"
  | "chars"
  | "burns"
  | "unsafe";

export interface HeatSetup {
  maxTempC: number;
  minutes: number;
  atmosphere: "air" | "nitrogen";
}

export const DEFAULT_HEAT: HeatSetup = {
  maxTempC: 150,
  minutes: 10,
  atmosphere: "air",
};

export interface HeatReport extends TestReport<HeatVerdict> {
  events: HeatEvent[];
  massLostPct: number;
  reversible: boolean | null;
}

interface HeatCandidate {
  event: HeatEvent;
  ingredientId?: string;
}

const PERMANENT_CROSSLINKS = new Set([
  "transglutaminase",
  "phenol-oxidase",
  "hrp-crosslinking",
  "genipin-amine",
  "glutaraldehyde-amine",
]);

function heatTone(verdict: HeatVerdict): TestTone {
  if (verdict === "stable") return "good";
  if (verdict === "dries-out" || verdict === "softens" || verdict === "melts") return "warn";
  return "bad";
}

function displayTime(seconds: number): string {
  return seconds > 7 * 24 * 60 * 60 ? "more than a week" : fmtTime(seconds);
}

export function heatTest(
  experiment: Experiment,
  result: RunResult,
  setup: HeatSetup,
): HeatReport {
  const parts = presentIngredients(experiment);
  const confidence = result.confidence;
  const metricDefaults = [
    { label: "Max temperature", value: `${setup.maxTempC} °C` },
    { label: "Mass lost", value: "about 0%" },
    { label: "First change", value: "none" },
    { label: "Reversible", value: "—" },
  ];
  const unsafe = (headline = "Unsafe mix; the model won't run this test."): HeatReport => ({
    ...unsafeReport<HeatVerdict>(confidence),
    headline,
    metrics: metricDefaults,
    events: [],
    massLostPct: 0,
    reversible: null,
  });
  if (result.product === "dangerous") return unsafe();
  if (parts.some(({ ingredient }) => ingredient.id === "sodium-metal")) {
    return unsafe("Sodium metal can catch fire when heated; the model won't run this.");
  }

  const active = activeEvents(result);
  const candidates: HeatCandidate[] = [];
  const add = (
    event: Omit<HeatEvent, "reversible"> & { reversible?: boolean },
    ingredientId?: string,
  ) => {
    candidates.push({
      event: { ...event, reversible: event.reversible ?? false },
      ingredientId,
    });
  };
  const gelatinPermanent = [...active].some((id) => PERMANENT_CROSSLINKS.has(id));
  if (active.has("gelatin-thermogel") && !gelatinPermanent) {
    add({
      tempC: 35,
      kind: "melt",
      reversible: true,
      text: "The gelatin network melts (it re-sets when cooled).",
    });
  }
  if (active.has("borax-pva")) {
    add({
      tempC: 50,
      kind: "soften",
      reversible: true,
      text: "Borate links loosen; the slime gets runnier (it firms up again when cool).",
    });
  }

  for (const { ingredient } of parts) {
    if (ingredient.boilC !== undefined) {
      add(
        {
          tempC: ingredient.boilC,
          kind: "evaporate",
          text:
            setup.minutes < 2
              ? `${ingredient.name} starts boiling off.`
              : `${ingredient.name} boils off.`,
        },
        ingredient.id,
      );
    }
    if (
      (ingredient.id === "graphene" || ingredient.id === "cnt") &&
      setup.atmosphere !== "air"
    ) {
      continue;
    }
    const table = THERMAL[ingredient.id];
    for (const event of table ?? []) add(event, ingredient.id);
    if (ingredient.category === "protein") {
      add(
        {
          tempC: 60,
          kind: "denature",
          text: "Proteins unfold (denature); this doesn't undo.",
        },
        ingredient.id,
      );
      if (!table) {
        const custom = ingredient.id.startsWith(CUSTOM_PREFIX);
        add(
          {
            tempC: 250,
            kind: "decompose",
            text: custom
              ? `${ingredient.name} probably chars (estimate).`
              : `${ingredient.name} chars.`,
          },
          ingredient.id,
        );
      }
    } else if (ingredient.category === "enzyme") {
      add(
        { tempC: 60, kind: "denature", text: "Enzymes stop working." },
        ingredient.id,
      );
    }
    if (
      ingredient.id.startsWith(CUSTOM_PREFIX) &&
      (ingredient.category === "polymer" || ingredient.category === "protein") &&
      !table
    ) {
      if (ingredient.category !== "protein") {
        add(
          {
            tempC: 250,
            kind: "decompose",
            text: `${ingredient.name} probably chars (estimate).`,
          },
          ingredient.id,
        );
      }
    }
  }

  const fired = candidates.filter(({ event }) => event.tempC <= setup.maxTempC);
  const organicDecompositions = fired.filter(
    ({ event, ingredientId }) =>
      event.kind === "decompose" &&
      ingredientId &&
      ["polymer", "protein", "enzyme", "additive"].includes(
        benchById[ingredientId]?.category ?? "",
      ),
  );
  if (setup.atmosphere === "air" && organicDecompositions.length) {
    const first = organicDecompositions.reduce((lowest, current) =>
      current.event.tempC < lowest.event.tempC ? current : lowest,
    );
    if (first.event.tempC + 100 <= setup.maxTempC) {
      add({
        tempC: first.event.tempC + 100,
        kind: "burn",
        text: "Can catch fire in air (modeled warning).",
      });
    }
  }
  if (
    setup.atmosphere === "air" &&
    setup.maxTempC >= 232 &&
    parts.some(({ ingredient }) => ingredient.id === "sulfur")
  ) {
    add({
      tempC: 232,
      kind: "burn",
      text: "Sulfur can burn, giving off toxic sulfur dioxide.",
    });
  }
  const firedCandidates = candidates.filter(({ event }) => event.tempC <= setup.maxTempC);
  firedCandidates.sort((a, b) => a.event.tempC - b.event.tempC);
  const unique = new Map<string, HeatEvent>();
  for (const { event } of firedCandidates) {
    if (!unique.has(event.text)) unique.set(event.text, event);
  }
  const events = [...unique.values()];
  if (setup.atmosphere === "nitrogen") {
    const firstDecompose = events.findIndex((event) => event.kind === "decompose");
    if (firstDecompose >= 0) {
      events[firstDecompose] = {
        ...events[firstDecompose],
        text: `${events[firstDecompose].text} (chars without burning: no oxygen)`,
      };
    }
  }
  const evaporatedIds = new Map<string, number>();
  for (const { ingredient } of parts) {
    if (
      ingredient.boilC !== undefined &&
      ingredient.boilC <= setup.maxTempC
    ) {
      evaporatedIds.set(ingredient.id, setup.minutes < 2 ? 0.5 : 1);
    }
  }
  const decomposedIds = new Set<string>();
  for (const { event, ingredientId } of firedCandidates) {
    if (!ingredientId) continue;
    if (event.kind === "evaporate") evaporatedIds.set(ingredientId, 1);
    if (event.kind === "decompose") decomposedIds.add(ingredientId);
  }
  const pctById = new Map(parts.map(({ ingredient, pct }) => [ingredient.id, pct]));
  const massLostPct = Math.max(
    0,
    Math.min(
      100,
      [...evaporatedIds].reduce(
        (sum, [id, fraction]) => sum + (pctById.get(id) ?? 0) * fraction,
        0,
      ) +
        [...decomposedIds].reduce(
          (sum, id) => sum + 0.5 * (pctById.get(id) ?? 0),
          0,
        ),
    ),
  );
  const severity: Record<HeatKind, number> = {
    evaporate: 1,
    gas: 1,
    soften: 2,
    denature: 2,
    melt: 3,
    decompose: 4,
    burn: 5,
  };
  const mostSevere = events.reduce<HeatEvent | null>(
    (current, event) =>
      !current || severity[event.kind] > severity[current.kind] ? event : current,
    null,
  );
  const verdict: HeatVerdict = !mostSevere
    ? "stable"
    : mostSevere.kind === "burn"
      ? "burns"
      : mostSevere.kind === "decompose"
        ? "chars"
        : mostSevere.kind === "melt"
          ? "melts"
          : mostSevere.kind === "soften" || mostSevere.kind === "denature"
            ? "softens"
            : "dries-out";
  const reversible =
    events.length > 0 && events.every((event) => event.reversible);
  const customUnknown = parts.filter(
    ({ ingredient }) => {
      if (!ingredient.id.startsWith(CUSTOM_PREFIX)) return false;
      if (ingredient.category === "polymer" || ingredient.category === "protein") {
        return !THERMAL[ingredient.id];
      }
      return ingredient.boilC === undefined && ingredient.category !== "enzyme";
    },
  );
  const notes = events.map((event) => event.text);
  if (reversible) notes.push("Cools back to roughly how it was.");
  for (const { ingredient } of customUnknown) {
    notes.push(`${ingredient.name}'s heat/water behavior isn't in the model.`);
  }
  const confidenceResult =
    customUnknown.length > 0 ? result.confidence * 0.8 : result.confidence;
  const headline =
    verdict === "stable"
      ? `Stays stable up to ${setup.maxTempC} °C.`
      : `At ${setup.maxTempC} °C it ${
          verdict === "dries-out"
            ? "dries out"
            : verdict === "softens"
              ? "softens"
              : verdict === "melts"
                ? "melts"
                : verdict === "chars"
                  ? "chars"
                  : "burns"
        }.`;
  return {
    verdict,
    tone: heatTone(verdict),
    headline,
    notes,
    metrics: [
      { label: "Max temperature", value: `${setup.maxTempC} °C` },
      { label: "Mass lost", value: `about ${Math.round(massLostPct)}%` },
      { label: "First change", value: events[0] ? `${events[0].tempC} °C` : "none" },
      { label: "Reversible", value: reversible ? "Yes" : events.length ? "No" : "—" },
    ],
    confidence: confidenceResult,
    events,
    massLostPct,
    reversible: events.length ? reversible : null,
  };
}

export type DissolveLiquid = "water" | "salt-water" | "acidic" | "alkaline";
export type DissolveVerdict =
  | "dissolves"
  | "swells"
  | "no-change"
  | "already-liquid"
  | "unsafe";

export interface DissolveSetup {
  liquid: DissolveLiquid;
  tempC: number;
  thicknessMm: number;
  stirred: boolean;
}

export const DEFAULT_DISSOLVE: DissolveSetup = {
  liquid: "water",
  tempC: 20,
  thicknessMm: 1,
  stirred: false,
};

export interface DissolveReport extends TestReport<DissolveVerdict> {
  timeSeconds: number | null;
  leftBehind: string[];
}

const LIQUID_LABELS: Record<DissolveLiquid, string> = {
  water: "Water",
  "salt-water": "Salt water",
  acidic: "Acidic water",
  alkaline: "Alkaline water",
};

export function dissolveTest(
  experiment: Experiment,
  result: RunResult,
  setup: DissolveSetup,
): DissolveReport {
  const parts = presentIngredients(experiment);
  const liquidLabel = LIQUID_LABELS[setup.liquid];
  const noChange = (
    verdict: "no-change" | "already-liquid" | "unsafe",
    headline: string,
    notes: string[],
    confidence = result.confidence,
  ): DissolveReport => ({
    verdict,
    tone: verdict === "unsafe" ? "bad" : "good",
    headline,
    notes,
    metrics: [
      { label: "Liquid", value: liquidLabel },
      { label: "Time", value: "—" },
      { label: "What's left", value: "—" },
    ],
    confidence,
    timeSeconds: null,
    leftBehind: [],
  });
  if (result.product === "dangerous") {
    return {
      ...noChange(
        "unsafe",
        "Unsafe mix; the model won't run this test.",
        [],
      ),
      headline: "Unsafe mix; the model won't run this test.",
    };
  }
  if (parts.some(({ ingredient }) => ingredient.id === "sodium-metal")) {
    return noChange(
      "unsafe",
      "Sodium metal reacts violently with water; the model won't run this.",
      [],
    );
  }
  if (result.product === "solution" || result.product === "nothing") {
    return noChange(
      "already-liquid",
      "It's already a liquid mix; it just blends in.",
      [],
    );
  }

  const active = activeEvents(result);
  let verdict: "dissolves" | "swells" | "no-change";
  let tRef = 60;
  const notes: string[] = [];
  const gelatinPresent = parts.some(({ ingredient }) => ingredient.id === "gelatin");
  const permanentlyCrosslinked = [...active].some((id) =>
    PERMANENT_CROSSLINKS.has(id),
  );
  if (gelatinPresent && !permanentlyCrosslinked) {
    if (setup.tempC >= 35) {
      verdict = "dissolves";
      tRef = 30;
      notes.push("Warm water melts the gelatin network.");
    } else {
      verdict = "swells";
      notes.push("Gelatin swells in cold water and only dissolves when warm.");
    }
  } else if (active.has("alginate-calcium") || active.has("alginate-fe-zn")) {
    if (setup.liquid === "salt-water") {
      verdict = "dissolves";
      tRef = 7200;
      notes.push("Sodium swaps out the calcium links, so it slowly falls apart.");
    } else {
      verdict = "swells";
      if (setup.liquid === "acidic") {
        notes.push("Acid firms it into an alginic-acid gel.");
      }
    }
  } else {
    const belowPH = parts.find(
      ({ ingredient, pct }) =>
        pct >= 5 && ingredient.dissolvesOnlyBelowPH !== undefined,
    );
    if (belowPH) {
      if (setup.liquid === "acidic") {
        verdict = "dissolves";
        notes.push("Chitosan dissolves in acid.");
      } else {
        verdict = "no-change";
        notes.push("Chitosan only dissolves in acid.");
      }
    } else if (active.has("borax-pva")) {
      verdict = "dissolves";
      if (setup.liquid === "acidic") {
        tRef = 30;
        notes.push("Acid breaks the borate links.");
      }
    } else {
      verdict =
        result.water === "dissolves"
          ? "dissolves"
          : result.water === "swells"
            ? "swells"
            : "no-change";
    }
  }
  const timeSeconds =
    verdict === "swells"
      ? (600 * setup.thicknessMm ** 2) /
        2 ** ((setup.tempC - 20) / 10) /
        (setup.stirred ? 2 : 1)
      : verdict === "dissolves"
        ? Math.max(
            1,
            (tRef * (setup.thicknessMm / 0.1) ** 2) /
              2 ** ((setup.tempC - 20) / 10) /
              (setup.stirred ? 2 : 1),
          )
        : null;
  const leftBehind = verdict === "dissolves"
    ? parts
        .filter(
          ({ ingredient }) =>
            ingredient.category === "element" ||
            ingredient.category === "filler" ||
            ingredient.id === "caco3",
        )
        .map(({ ingredient }) => ingredient.name)
    : [];
  if (leftBehind.length) notes.push(`Leaves behind: ${leftBehind.join(", ")}.`);
  const customUnknown = parts.filter(({ ingredient }) => {
    if (!ingredient.id.startsWith(CUSTOM_PREFIX)) return false;
    if (ingredient.dissolvesOnlyBelowPH !== undefined) return false;
    return !(
      active.has("borax-pva") &&
      ingredient.category === "polymer" &&
      ingredient.tags.includes("diol")
    );
  });
  for (const { ingredient } of customUnknown) {
    notes.push(`${ingredient.name}'s heat/water behavior isn't in the model.`);
  }
  const confidence =
    customUnknown.length > 0 ? result.confidence * 0.8 : result.confidence;
  const timeLabel =
    timeSeconds === null
      ? "—"
      : verdict === "swells"
        ? `Swells over ~${displayTime(timeSeconds)}`
        : displayTime(timeSeconds);
  const headline =
    verdict === "dissolves"
      ? `Dissolves in about ${displayTime(timeSeconds ?? 0)}.`
      : verdict === "swells"
        ? `Swells over about ${displayTime(timeSeconds ?? 0)}.`
        : "No visible change in this liquid.";
  return {
    verdict,
    tone: verdict === "swells" ? "warn" : "good",
    headline,
    notes,
    metrics: [
      { label: "Liquid", value: liquidLabel },
      { label: "Time", value: timeLabel },
      { label: "What's left", value: leftBehind.join(", ") || "—" },
    ],
    confidence,
    timeSeconds,
    leftBehind,
  };
}

export type StickSurface = "glass" | "steel" | "wood" | "plastic" | "ptfe" | "skin";
export type StickVerdict = "sticks" | "weak" | "no-stick" | "unsafe";

export interface StickSetup {
  surface: StickSurface;
  areaCm2: number;
  pressMinutes: number;
}

export const DEFAULT_STICK: StickSetup = {
  surface: "glass",
  areaCm2: 1,
  pressMinutes: 5,
};

export interface StickReport extends TestReport<StickVerdict> {
  holdsKg: number;
  bondMPa: number;
  cureFrac: number;
  cohesiveFailure: boolean;
}

export const STICK_SURFACE_LABELS: Record<StickSurface, string> = {
  glass: "Glass",
  steel: "Steel",
  wood: "Wood",
  plastic: "Plastic",
  ptfe: "Non-stick (PTFE)",
  skin: "Skin",
};

export function stickTest(
  _experiment: Experiment,
  result: RunResult,
  setup: StickSetup,
): StickReport {
  if (result.product === "dangerous") {
    return {
      ...unsafeReport<StickVerdict>(result.confidence),
      holdsKg: 0,
      bondMPa: 0,
      cureFrac: 0,
      cohesiveFailure: false,
    };
  }
  if (setup.surface === "skin" && result.skin >= 2) {
    return {
      ...unsafeReport<StickVerdict>(result.confidence),
      headline: "Not skin-safe; the model won't test it on skin.",
      holdsKg: 0,
      bondMPa: 0,
      cureFrac: 0,
      cohesiveFailure: false,
    };
  }
  const factors: Record<StickSurface, number> = {
    glass: 1,
    steel: 1,
    wood: 0.8,
    plastic: 0.3,
    ptfe: 0.05,
    skin: 0.4,
  };
  const grip = 0.01 * result.tack;
  const adhesive = result.product === "adhesive";
  const cured = adhesive
    ? (result.tack / 10) ** 2 * 20
    : ["gel", "film", "solid", "fiber"].includes(result.product) && result.tack >= 3
      ? (result.tack / 10) ** 2 * 2
      : 0;
  const cureFrac =
    result.setSeconds > 0
      ? Math.min(1, (setup.pressMinutes * 60) / result.setSeconds)
      : 0;
  const adhesion = Math.max(grip, cured * cureFrac) * factors[setup.surface];
  const cohesion = result.tensileMPa > 0 ? result.tensileMPa : grip;
  const bondMPa = Math.min(adhesion, cohesion);
  const holdsKg = (bondMPa * 1e6 * setup.areaCm2 * 1e-4) / 9.81;
  const cohesiveFailure = adhesion > cohesion;
  const liquidNoStick =
    (result.product === "solution" || result.product === "nothing") &&
    result.tack < 1;
  const verdict: StickVerdict = liquidNoStick
    ? "no-stick"
    : holdsKg >= 0.1
      ? "sticks"
      : "weak";
  const notes = [
    cohesiveFailure
      ? "It tears inside itself and leaves residue on both sides."
      : "Peels off cleanly from the surface.",
  ];
  if (result.setSeconds > 0 && cureFrac < 1) {
    notes.push(
      `Not fully set; press for at least ${fmtTime(result.setSeconds)} for full strength.`,
    );
  }
  if (setup.surface === "ptfe") {
    notes.push("Almost nothing sticks to non-stick coatings.");
  }
  if (setup.surface === "skin") {
    notes.push(
      "Rough model of skin; real skin is oily and stretchy, and some glues can bond skin—don't try it.",
    );
  }
  if (liquidNoStick) notes.unshift("It runs off; there's nothing tacky to hold.");
  return {
    verdict,
    tone: verdict === "sticks" ? "good" : "warn",
    headline: liquidNoStick
      ? "It runs off; there's nothing tacky to hold."
      : verdict === "sticks"
        ? `Holds about ${displayNumber(holdsKg)} kg on ${STICK_SURFACE_LABELS[setup.surface]}.`
        : `It holds only about ${displayNumber(holdsKg)} kg on ${STICK_SURFACE_LABELS[setup.surface]}.`,
    notes,
    metrics: [
      { label: "Holds", value: `${displayNumber(holdsKg)} kg` },
      { label: "Bond strength", value: `${displayNumber(bondMPa)} MPa` },
      { label: "Set", value: `${Math.round(cureFrac * 100)}%` },
      {
        label: "How it fails",
        value: cohesiveFailure ? "Tears inside itself" : "Peels off cleanly",
      },
    ],
    confidence: result.confidence,
    holdsKg,
    bondMPa,
    cureFrac,
    cohesiveFailure,
  };
}

export type DropFloor = "hard" | "soft";
export type DropVerdict =
  | "survives"
  | "cracks"
  | "breaks"
  | "splats"
  | "splashes"
  | "scatters"
  | "unsafe";

export interface DropSetup {
  heightM: number;
  diameterMm: number;
  floor: DropFloor;
}

export const DEFAULT_DROP: DropSetup = {
  heightM: 1,
  diameterMm: 30,
  floor: "hard",
};

export interface DropReport extends TestReport<DropVerdict> {
  bounceM: number | null;
  impactSpeedMs: number;
  energyJ: number;
  massKg: number;
}

export function dropTest(
  experiment: Experiment,
  result: RunResult,
  setup: DropSetup,
): DropReport {
  if (result.product === "dangerous") {
    return {
      ...unsafeReport<DropVerdict>(result.confidence),
      bounceM: null,
      impactSpeedMs: 0,
      energyJ: 0,
      massKg: 0,
    };
  }
  const g = 9.81;
  const densityKgM3 = fluidFromMix(experiment, result).densityKgM3;
  const impactSpeedMs = Math.sqrt(2 * g * setup.heightM);
  const massKg =
    densityKgM3 *
    ((4 / 3) * Math.PI * (setup.diameterMm / 2000) ** 3);
  const energyJ = massKg * g * setup.heightM;
  const hit = densityKgM3 * g * setup.heightM * (setup.floor === "soft" ? 0.4 : 1);
  const tough = result.toughnessMJm3 * 1e6;
  const parts = presentIngredients(experiment);
  const rubbery =
    percentWithTag(parts, "elastomer") >= 10 || result.elongationPct >= 200;
  const elasticity = rubbery ? 0.7 : result.product === "gel" ? 0.3 : 0.2;
  const effectiveElasticity = setup.floor === "soft" ? elasticity * 0.5 : elasticity;
  const bounceM = setup.heightM * effectiveElasticity ** 2;
  let verdict: DropVerdict;
  let headline: string;
  if (result.product === "solution" || result.product === "nothing") {
    verdict = "splashes";
    headline = "It splashes on impact.";
  } else if (result.product === "clumps") {
    verdict = "scatters";
    headline = "The clumps scatter on impact.";
  } else if (result.product === "slime") {
    verdict = "splats";
    headline = "It splats and slowly flows flat.";
  } else if (tough <= 0 || hit > tough) {
    verdict = "breaks";
    headline =
      result.product === "gel"
        ? "It shatters into pieces."
        : "It breaks on impact.";
  } else if (hit > 0.5 * tough) {
    verdict = "cracks";
    headline = "It cracks on impact.";
  } else {
    verdict = "survives";
    headline =
      bounceM > 0.01
        ? `Survives and bounces back up about ${displayNumber(bounceM)} m.`
        : "Survives the drop.";
  }
  const tone: TestTone =
    verdict === "survives"
      ? "good"
      : verdict === "breaks" || verdict === "scatters"
        ? "bad"
        : "warn";
  return {
    verdict,
    tone,
    headline,
    notes: ["Ignores air drag, so long drops are overestimated."],
    metrics: [
      { label: "Impact speed", value: `${displayNumber(impactSpeedMs)} m/s` },
      { label: "Impact energy", value: `${displayNumber(energyJ)} J` },
      {
        label: "Bounce height",
        value: verdict === "survives" ? `${displayNumber(bounceM)} m` : "—",
      },
      { label: "Weight", value: `${displayNumber(massKg * 1000)} g` },
    ],
    confidence: result.confidence,
    bounceM: verdict === "survives" ? bounceM : null,
    impactSpeedMs,
    energyJ,
    massKg,
  };
}
