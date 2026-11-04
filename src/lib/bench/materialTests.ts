import { fmtTime } from "../formula";
import { CUSTOM_PREFIX } from "./custom";
import { benchById, localizeBenchIngredient } from "./library";
import { fluidFromMix } from "./shootTest";
import type { BenchIngredient, Experiment, RunResult } from "./types";
import { DEFAULT_LOCALE, tr, type Locale, type MessageKey } from "../i18n";

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

function ingredientName(ingredient: BenchIngredient, locale: Locale): string {
  return localizeBenchIngredient(ingredient, locale).name;
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

function displayNumber(value: number, digits = 3, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toPrecision(digits)).toLocaleString(locale === "es" ? "es" : "en-US");
}

function unsafeReport<V extends string>(confidence: number, locale: Locale): TestReport<V> {
  return {
    verdict: "unsafe" as V,
    tone: "bad",
    headline: tr(locale, "bench.model.material.unsafe"),
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
  locale: Locale,
): StretchReport {
  return {
    verdict,
    tone: verdict === "unsafe" || verdict === "falls-apart" ? "bad" : "warn",
    headline,
    notes: [],
    metrics: [
      { label: tr(locale, "bench.model.material.breakingForce"), value: "— N" },
      { label: tr(locale, "bench.model.material.holds"), value: "— kg" },
      { label: tr(locale, "bench.model.material.lengthBreak"), value: "— mm" },
      { label: tr(locale, "bench.model.material.energyBreak"), value: "— J" },
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

function stretchTestCore(
  experiment: Experiment,
  result: RunResult,
  setup: StretchSetup,
  locale: Locale,
): StretchReport {
  if (result.product === "dangerous") {
    return emptyStretch(
      "unsafe",
      tr(locale, "bench.model.material.unsafe"),
      result.confidence,
      locale,
    );
  }
  if (result.product === "solution" || result.product === "nothing") {
    return emptyStretch(
      "nothing-to-test",
      tr(locale, "bench.model.material.noSolid"),
      result.confidence,
      locale,
    );
  }
  if (result.product === "clumps") {
    return emptyStretch(
      "falls-apart",
      tr(locale, "bench.model.material.clumps"),
      result.confidence,
      locale,
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
  if (rubbery) notes.push(tr(locale, "bench.model.material.rubbery"));
  if (result.elongationPct < 5) notes.push(tr(locale, "bench.model.material.brittle"));
  const verdict: StretchVerdict = flows ? "flows" : snaps ? "snaps" : "breaks";
  const headline = flows
    ? tr(locale, "bench.model.material.flows")
    : snaps
      ? tr(locale, "bench.model.material.snaps")
      : tr(locale, "bench.model.material.breaksAt", {
          force: displayNumber(breakN, 3, locale),
          stretch: displayNumber(elongationPct, 3, locale),
        });
  return {
    verdict,
    tone: flows || snaps ? "warn" : "good",
    headline,
    notes,
    metrics: [
      { label: tr(locale, "bench.model.material.breakingForce"), value: `${displayNumber(breakN, 3, locale)} N` },
      { label: tr(locale, "bench.model.material.holds"), value: `${displayNumber(holdsKg, 3, locale)} kg` },
      { label: tr(locale, "bench.model.material.lengthBreak"), value: `${displayNumber(breakLengthMm, 3, locale)} mm` },
      { label: tr(locale, "bench.model.material.energyBreak"), value: `${displayNumber(energyJ, 3, locale)} J` },
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

type ThermalEntry = Omit<HeatEvent, "reversible"> & { text: MessageKey; reversible?: boolean };

const THERMAL: Record<string, ThermalEntry[]> = {
  pva: [{ tempC: 200, kind: "decompose", text: "bench.model.material.thermal.pva" }],
  alginate: [{ tempC: 200, kind: "decompose", text: "bench.model.material.thermal.alginate" }],
  "hyaluronic-acid": [{ tempC: 200, kind: "decompose", text: "bench.model.material.thermal.hyaluronic" }],
  chitosan: [{ tempC: 250, kind: "decompose", text: "bench.model.material.thermal.chitosan" }],
  pu: [{ tempC: 250, kind: "decompose", text: "bench.model.material.thermal.polyurethane" }],
  latex: [{ tempC: 300, kind: "decompose", text: "bench.model.material.thermal.rubber" }],
  pib: [{ tempC: 300, kind: "decompose", text: "bench.model.material.thermal.polyisobutylene" }],
  nylon66: [
    { tempC: 265, kind: "melt", text: "bench.model.material.thermal.nylonMelt" },
    { tempC: 350, kind: "decompose", text: "bench.model.material.thermal.nylonBreaks" },
  ],
  cyanoacrylate: [
    { tempC: 80, kind: "soften", text: "bench.model.material.thermal.superglueSoftens" },
    { tempC: 200, kind: "decompose", text: "bench.model.material.thermal.superglueBreaks" },
  ],
  cnf: [{ tempC: 280, kind: "decompose", text: "bench.model.material.thermal.cellulose" }],
  glycerol: [{ tempC: 290, kind: "evaporate", text: "bench.model.material.thermal.glycerol" }],
  sulfur: [{ tempC: 115, kind: "melt", text: "bench.model.material.thermal.sulfur" }],
  "sodium-bicarbonate": [{ tempC: 80, kind: "gas", text: "bench.model.material.thermal.bakingSoda" }],
  "citric-acid": [{ tempC: 175, kind: "decompose", text: "bench.model.material.thermal.citricAcid" }],
  "acetic-acid": [{ tempC: 118, kind: "evaporate", text: "bench.model.material.thermal.aceticAcid" }],
  "formic-acid": [{ tempC: 101, kind: "evaporate", text: "bench.model.material.thermal.formicAcid" }],
  "hydrogen-peroxide": [{ tempC: 50, kind: "gas", text: "bench.model.material.thermal.peroxide" }],
  fecl3: [{ tempC: 306, kind: "melt", text: "bench.model.material.thermal.ironChloride" }],
  caco3: [{ tempC: 825, kind: "gas", text: "bench.model.material.thermal.calciumCarbonate" }],
  cacl2: [{ tempC: 772, kind: "melt", text: "bench.model.material.thermal.calciumChloride" }],
  nacl: [{ tempC: 801, kind: "melt", text: "bench.model.material.thermal.salt" }],
  kcl: [{ tempC: 770, kind: "melt", text: "bench.model.material.thermal.potassiumChloride" }],
  graphene: [{ tempC: 550, kind: "decompose", text: "bench.model.material.thermal.graphene" }],
  cnt: [{ tempC: 550, kind: "decompose", text: "bench.model.material.thermal.nanotubes" }],
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

function displayTime(seconds: number, locale: Locale): string {
  return seconds > 7 * 24 * 60 * 60
    ? tr(locale, "bench.model.material.moreThanWeek")
    : fmtTime(seconds, locale);
}

function heatTestCore(
  experiment: Experiment,
  result: RunResult,
  setup: HeatSetup,
  locale: Locale,
): HeatReport {
  const parts = presentIngredients(experiment);
  const confidence = result.confidence;
  const metricDefaults = [
    { label: tr(locale, "bench.model.material.maxTemperature"), value: `${setup.maxTempC} °C` },
    { label: tr(locale, "bench.model.material.massLost"), value: tr(locale, "bench.model.material.aboutZero") },
    { label: tr(locale, "bench.model.material.firstChange"), value: tr(locale, "bench.model.material.none") },
    { label: tr(locale, "bench.model.material.reversible"), value: "—" },
  ];
  const unsafe = (headline = tr(locale, "bench.model.material.unsafe")): HeatReport => ({
    ...unsafeReport<HeatVerdict>(confidence, locale),
    headline,
    metrics: metricDefaults,
    events: [],
    massLostPct: 0,
    reversible: null,
  });
  if (result.product === "dangerous") return unsafe();
  if (parts.some(({ ingredient }) => ingredient.id === "sodium-metal")) {
    return unsafe(tr(locale, "bench.model.material.sodiumHeatUnsafe"));
  }

  const active = activeEvents(result);
  const candidates: HeatCandidate[] = [];
  const add = (
    event: Omit<HeatEvent, "reversible"> & { reversible?: boolean },
    ingredientId?: string,
    localized = false,
  ) => {
    candidates.push({
      event: {
        ...event,
        text: localized ? event.text : tr(locale, event.text as MessageKey),
        reversible: event.reversible ?? false,
      },
      ingredientId,
    });
  };
  const gelatinPermanent = [...active].some((id) => PERMANENT_CROSSLINKS.has(id));
  if (active.has("gelatin-thermogel") && !gelatinPermanent) {
    add({
      tempC: 35,
      kind: "melt",
      reversible: true,
      text: "bench.model.material.gelatinMelt",
    });
  }
  if (active.has("borax-pva")) {
    add({
      tempC: 50,
      kind: "soften",
      reversible: true,
      text: "bench.model.material.borateSoftens",
    });
  }

  for (const { ingredient } of parts) {
    if (ingredient.boilC !== undefined) {
      add(
        {
          tempC: ingredient.boilC,
          kind: "evaporate",
          text: tr(locale, setup.minutes < 2
            ? "bench.model.material.startsBoiling"
            : "bench.model.material.boilsOff", {
            ingredient: ingredientName(ingredient, locale),
          }),
        },
        ingredient.id,
        true,
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
          text: "bench.model.material.proteinsDenature",
        },
        ingredient.id,
      );
      if (!table) {
        const custom = ingredient.id.startsWith(CUSTOM_PREFIX);
        add(
          {
            tempC: 250,
            kind: "decompose",
            text: tr(locale, custom
              ? "bench.model.material.charsEstimate"
              : "bench.model.material.chars", { ingredient: ingredientName(ingredient, locale) }),
          },
          ingredient.id,
          true,
        );
      }
    } else if (ingredient.category === "enzyme") {
      add(
        { tempC: 60, kind: "denature", text: "bench.model.material.enzymesStop" },
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
            text: tr(locale, "bench.model.material.charsEstimate", { ingredient: ingredientName(ingredient, locale) }),
          },
          ingredient.id,
          true,
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
        text: "bench.model.material.fireWarning",
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
      text: "bench.model.material.sulfurBurn",
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
      const text = events[firstDecompose].text.replace(/\.$/, "");
      events[firstDecompose] = {
        ...events[firstDecompose],
        text: tr(locale, "bench.model.material.withoutBurning", { event: text }),
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
  if (reversible) notes.push(tr(locale, "bench.model.material.coolsBack"));
  for (const { ingredient } of customUnknown) {
    notes.push(tr(locale, "bench.model.material.unknownHeat", { ingredient: ingredientName(ingredient, locale) }));
  }
  const confidenceResult =
    customUnknown.length > 0 ? result.confidence * 0.8 : result.confidence;
  const changeKeys: Record<HeatVerdict, MessageKey> = {
    "dries-out": "bench.model.material.change.driesOut",
    softens: "bench.model.material.change.softens",
    melts: "bench.model.material.change.melts",
    chars: "bench.model.material.change.chars",
    burns: "bench.model.material.change.burns",
    stable: "bench.model.material.none",
    unsafe: "bench.model.material.none",
  };
  const changeKey = changeKeys[verdict];
  const headline = verdict === "stable"
    ? tr(locale, "bench.model.material.staysStable", { temperature: setup.maxTempC })
    : tr(locale, "bench.model.material.atTemperature", {
        temperature: setup.maxTempC,
        change: tr(locale, changeKey),
      });
  return {
    verdict,
    tone: heatTone(verdict),
    headline,
    notes,
    metrics: [
      { label: tr(locale, "bench.model.material.maxTemperature"), value: `${setup.maxTempC} °C` },
      { label: tr(locale, "bench.model.material.massLost"), value: tr(locale, "bench.model.material.percentAbout", { percent: Math.round(massLostPct) }) },
      { label: tr(locale, "bench.model.material.firstChange"), value: events[0] ? `${events[0].tempC} °C` : tr(locale, "bench.model.material.none") },
      { label: tr(locale, "bench.model.material.reversible"), value: reversible ? tr(locale, "bench.model.material.yes") : events.length ? tr(locale, "bench.model.material.no") : "—" },
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

export const DISSOLVE_LIQUID_LABEL_KEYS: Record<DissolveLiquid, MessageKey> = {
  water: "bench.model.material.water",
  "salt-water": "bench.model.material.saltWater",
  acidic: "bench.model.material.acidicWater",
  alkaline: "bench.model.material.alkalineWater",
};

function dissolveTestCore(
  experiment: Experiment,
  result: RunResult,
  setup: DissolveSetup,
  locale: Locale,
): DissolveReport {
  const parts = presentIngredients(experiment);
  const liquidLabel = tr(locale, DISSOLVE_LIQUID_LABEL_KEYS[setup.liquid]);
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
      { label: tr(locale, "bench.model.material.liquid"), value: liquidLabel },
      { label: tr(locale, "bench.model.material.time"), value: "—" },
      { label: tr(locale, "bench.model.material.whatsLeft"), value: "—" },
    ],
    confidence,
    timeSeconds: null,
    leftBehind: [],
  });
  if (result.product === "dangerous") {
    return {
      ...noChange(
        "unsafe",
        tr(locale, "bench.model.material.unsafe"),
        [],
      ),
      headline: tr(locale, "bench.model.material.unsafe"),
    };
  }
  if (parts.some(({ ingredient }) => ingredient.id === "sodium-metal")) {
    return noChange(
      "unsafe",
      tr(locale, "bench.model.material.sodiumWaterUnsafe"),
      [],
    );
  }
  if (result.product === "solution" || result.product === "nothing") {
    return noChange(
      "already-liquid",
      tr(locale, "bench.model.material.alreadyLiquid"),
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
      notes.push(tr(locale, "bench.model.material.warmGelatin"));
    } else {
      verdict = "swells";
      notes.push(tr(locale, "bench.model.material.coldGelatin"));
    }
  } else if (active.has("alginate-calcium") || active.has("alginate-fe-zn")) {
    if (setup.liquid === "salt-water") {
      verdict = "dissolves";
      tRef = 7200;
      notes.push(tr(locale, "bench.model.material.sodiumCalcium"));
    } else {
      verdict = "swells";
      if (setup.liquid === "acidic") {
        notes.push(tr(locale, "bench.model.material.acidGel"));
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
        notes.push(tr(locale, "bench.model.material.chitosanDissolves"));
      } else {
        verdict = "no-change";
        notes.push(tr(locale, "bench.model.material.chitosanOnlyAcid"));
      }
    } else if (active.has("borax-pva")) {
      verdict = "dissolves";
      if (setup.liquid === "acidic") {
        tRef = 30;
        notes.push(tr(locale, "bench.model.material.acidBorate"));
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
        .map(({ ingredient }) => ingredientName(ingredient, locale))
    : [];
  if (leftBehind.length) notes.push(tr(locale, "bench.model.material.leftBehind", { ingredients: leftBehind.join(", ") }));
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
    notes.push(tr(locale, "bench.model.material.unknownHeat", { ingredient: ingredientName(ingredient, locale) }));
  }
  const confidence =
    customUnknown.length > 0 ? result.confidence * 0.8 : result.confidence;
  const timeLabel =
    timeSeconds === null
      ? "—"
      : verdict === "swells"
        ? tr(locale, "bench.model.material.swellsOver", { time: displayTime(timeSeconds, locale) })
        : displayTime(timeSeconds, locale);
  const headline =
    verdict === "dissolves"
      ? tr(locale, "bench.model.material.dissolvesIn", { time: displayTime(timeSeconds ?? 0, locale) })
      : verdict === "swells"
        ? tr(locale, "bench.model.material.swellsAbout", { time: displayTime(timeSeconds ?? 0, locale) })
        : tr(locale, "bench.model.material.noVisibleChange");
  return {
    verdict,
    tone: verdict === "swells" ? "warn" : "good",
    headline,
    notes,
    metrics: [
      { label: tr(locale, "bench.model.material.liquid"), value: liquidLabel },
      { label: tr(locale, "bench.model.material.time"), value: timeLabel },
      { label: tr(locale, "bench.model.material.whatsLeft"), value: leftBehind.join(", ") || "—" },
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
  glass: tr("en", "bench.model.material.surface.glass"),
  steel: tr("en", "bench.model.material.surface.steel"),
  wood: tr("en", "bench.model.material.surface.wood"),
  plastic: tr("en", "bench.model.material.surface.plastic"),
  ptfe: tr("en", "bench.model.material.nonStickPTFE"),
  skin: tr("en", "bench.model.material.surface.skin"),
};

export const STICK_SURFACE_LABEL_KEYS: Record<StickSurface, MessageKey> = {
  glass: "bench.model.material.surface.glass",
  steel: "bench.model.material.surface.steel",
  wood: "bench.model.material.surface.wood",
  plastic: "bench.model.material.surface.plastic",
  ptfe: "bench.model.material.nonStickPTFE",
  skin: "bench.model.material.surface.skin",
};

function stickTestCore(
  _experiment: Experiment,
  result: RunResult,
  setup: StickSetup,
  locale: Locale,
): StickReport {
  if (result.product === "dangerous") {
    return {
      ...unsafeReport<StickVerdict>(result.confidence, locale),
      holdsKg: 0,
      bondMPa: 0,
      cureFrac: 0,
      cohesiveFailure: false,
    };
  }
  if (setup.surface === "skin" && result.skin >= 2) {
    return {
      ...unsafeReport<StickVerdict>(result.confidence, locale),
      headline: tr(locale, "bench.model.material.notSkinSafe"),
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
      ? tr(locale, "bench.model.material.tears")
      : tr(locale, "bench.model.material.peels"),
  ];
  if (result.setSeconds > 0 && cureFrac < 1) {
    notes.push(
      tr(locale, "bench.model.material.pressSet", { time: fmtTime(result.setSeconds, locale) }),
    );
  }
  if (setup.surface === "ptfe") {
    notes.push(tr(locale, "bench.model.material.nonStickCoatings"));
  }
  if (setup.surface === "skin") {
    notes.push(
      tr(locale, "bench.model.material.skinCaution"),
    );
  }
  if (liquidNoStick) notes.unshift(tr(locale, "bench.model.material.runsOff"));
  const surface = tr(locale, STICK_SURFACE_LABEL_KEYS[setup.surface]);
  return {
    verdict,
    tone: verdict === "sticks" ? "good" : "warn",
    headline: liquidNoStick
      ? tr(locale, "bench.model.material.runsOff")
      : verdict === "sticks"
        ? tr(locale, "bench.model.material.holdsOn", { weight: displayNumber(holdsKg, 3, locale), surface })
        : tr(locale, "bench.model.material.holdsOnly", { weight: displayNumber(holdsKg, 3, locale), surface }),
    notes,
    metrics: [
      { label: tr(locale, "bench.model.material.holds"), value: `${displayNumber(holdsKg, 3, locale)} kg` },
      { label: tr(locale, "bench.model.material.bondStrength"), value: `${displayNumber(bondMPa, 3, locale)} MPa` },
      { label: tr(locale, "bench.model.material.set"), value: `${Math.round(cureFrac * 100)}%` },
      {
        label: tr(locale, "bench.model.material.howFails"),
        value: cohesiveFailure ? tr(locale, "bench.model.material.tearsInside") : tr(locale, "bench.model.material.peelsCleanly"),
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
export const DROP_FLOOR_LABEL_KEYS: Record<DropFloor, MessageKey> = {
  hard: "bench.test.hard",
  soft: "bench.test.soft",
};
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

function dropTestCore(
  experiment: Experiment,
  result: RunResult,
  setup: DropSetup,
  locale: Locale,
): DropReport {
  if (result.product === "dangerous") {
    return {
      ...unsafeReport<DropVerdict>(result.confidence, locale),
      bounceM: null,
      impactSpeedMs: 0,
      energyJ: 0,
      massKg: 0,
    };
  }
  const g = 9.81;
  const densityKgM3 = fluidFromMix(experiment, result, locale).densityKgM3;
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
    headline = tr(locale, "bench.model.material.splashes");
  } else if (result.product === "clumps") {
    verdict = "scatters";
    headline = tr(locale, "bench.model.material.clumpsScatter");
  } else if (result.product === "slime") {
    verdict = "splats";
    headline = tr(locale, "bench.model.material.splats");
  } else if (tough <= 0 || hit > tough) {
    verdict = "breaks";
    headline =
      result.product === "gel"
        ? tr(locale, "bench.model.material.shatters")
        : tr(locale, "bench.model.material.breaksImpact");
  } else if (hit > 0.5 * tough) {
    verdict = "cracks";
    headline = tr(locale, "bench.model.material.cracksImpact");
  } else {
    verdict = "survives";
    headline =
      bounceM > 0.01
        ? tr(locale, "bench.model.material.bounces", { height: displayNumber(bounceM, 3, locale) })
        : tr(locale, "bench.model.material.survives");
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
    notes: [tr(locale, "bench.model.material.airDrag")],
    metrics: [
      { label: tr(locale, "bench.model.material.impactSpeed"), value: `${displayNumber(impactSpeedMs, 3, locale)} m/s` },
      { label: tr(locale, "bench.model.material.impactEnergy"), value: `${displayNumber(energyJ, 3, locale)} J` },
      {
        label: tr(locale, "bench.model.material.bounceHeight"),
        value: verdict === "survives" ? `${displayNumber(bounceM, 3, locale)} m` : "—",
      },
      { label: tr(locale, "bench.model.material.weight"), value: `${displayNumber(massKg * 1000, 3, locale)} g` },
    ],
    confidence: result.confidence,
    bounceM: verdict === "survives" ? bounceM : null,
    impactSpeedMs,
    energyJ,
    massKg,
  };
}

export function stretchTest(
  experiment: Experiment,
  result: RunResult,
  setup: StretchSetup,
  locale: Locale = DEFAULT_LOCALE,
): StretchReport {
  return stretchTestCore(experiment, result, setup, locale);
}

export function heatTest(
  experiment: Experiment,
  result: RunResult,
  setup: HeatSetup,
  locale: Locale = DEFAULT_LOCALE,
): HeatReport {
  return heatTestCore(experiment, result, setup, locale);
}

export function dissolveTest(
  experiment: Experiment,
  result: RunResult,
  setup: DissolveSetup,
  locale: Locale = DEFAULT_LOCALE,
): DissolveReport {
  return dissolveTestCore(experiment, result, setup, locale);
}

export function stickTest(
  experiment: Experiment,
  result: RunResult,
  setup: StickSetup,
  locale: Locale = DEFAULT_LOCALE,
): StickReport {
  return stickTestCore(experiment, result, setup, locale);
}

export function dropTest(
  experiment: Experiment,
  result: RunResult,
  setup: DropSetup,
  locale: Locale = DEFAULT_LOCALE,
): DropReport {
  return dropTestCore(experiment, result, setup, locale);
}
