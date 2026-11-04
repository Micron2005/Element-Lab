import { tr, type Locale, type MessageKey } from "../i18n";
import type {
  DissolveVerdict,
  DropVerdict,
  HeatVerdict,
  HeatSetup,
  StickVerdict,
  StretchVerdict,
} from "./materialTests";
import type { ShotVerdict } from "./shootTest";
import type { Category, EventStatus, Hazard, Product, WaterBehavior } from "./types";

export type IngredientFilter =
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

export const BENCH_FILTER_OPTIONS: readonly IngredientFilter[] = [
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

export const BENCH_FILTER_LABEL_KEYS: Record<IngredientFilter, MessageKey> = {
  All: "ui.category.All",
  Elements: "ui.category.Elements",
  Salts: "ui.category.Salts",
  Proteins: "ui.category.Proteins",
  Enzymes: "ui.category.Enzymes",
  Polymers: "ui.category.Polymers",
  Solvents: "ui.category.Solvents",
  "Acids/Bases": "ui.category.Acids/Bases",
  Additives: "ui.category.Additives",
  Mine: "ui.category.Mine",
};

export const CATEGORY_LABEL_KEYS: Record<Category, MessageKey> = {
  element: "report.category.element",
  salt: "report.category.salt",
  protein: "report.category.protein",
  enzyme: "report.category.enzyme",
  polymer: "report.category.polymer",
  solvent: "report.category.solvent",
  "acid-base": "report.category.acidBase",
  additive: "report.category.additive",
  filler: "report.category.filler",
};

export const CUSTOM_CATEGORY_LABEL_KEYS: Record<Category, MessageKey> = {
  element: "bench.custom.option.element",
  salt: "bench.custom.option.salt",
  protein: "bench.custom.option.protein",
  enzyme: "bench.custom.option.enzyme",
  polymer: "bench.custom.option.polymer",
  solvent: "bench.custom.option.solvent",
  "acid-base": "bench.custom.option.acidBase",
  additive: "bench.custom.option.additive",
  filler: "bench.custom.option.filler",
};

export const CUSTOM_HAZARD_LABEL_KEYS: Record<Hazard, MessageKey> = {
  0: "bench.custom.hazard.safe",
  1: "bench.custom.hazard.mild",
  2: "bench.custom.hazard.harmful",
  3: "bench.custom.hazard.toxic",
};

export const CUSTOM_WATER_LABEL_KEYS: Record<WaterBehavior, MessageKey> = {
  dissolves: "bench.custom.option.dissolves",
  swells: "bench.custom.option.swells",
  resists: "bench.custom.option.resists",
};

export const BENCH_WATER_LABEL_KEYS: Record<WaterBehavior, MessageKey> = {
  dissolves: "bench.water.dissolves",
  swells: "bench.water.swells",
  resists: "bench.water.resists",
};

export const BENCH_PRODUCT_LABEL_KEYS: Record<Product, MessageKey> = {
  gel: "bench.product.gel",
  slime: "bench.product.slime",
  fiber: "bench.product.fiber",
  film: "bench.product.film",
  adhesive: "bench.product.adhesive",
  solid: "bench.product.solid",
  solution: "bench.product.solution",
  clumps: "bench.product.clumps",
  nothing: "bench.product.nothing",
  dangerous: "bench.product.dangerous",
};

export const BENCH_EVENT_STATUS_LABEL_KEYS: Record<EventStatus, MessageKey> = {
  happened: "bench.eventStatus.happened",
  partial: "bench.eventStatus.partial",
  blocked: "bench.eventStatus.blocked",
};

export const BENCH_REACTION_STATUS_LABEL_KEYS: Record<EventStatus, MessageKey> = {
  happened: "bench.reaction.status.happened",
  partial: "bench.reaction.status.partial",
  blocked: "bench.reaction.status.blocked",
};

export const BENCH_HEAT_ATMOSPHERE_LABEL_KEYS: Record<
  HeatSetup["atmosphere"],
  MessageKey
> = {
  air: "bench.test.air",
  nitrogen: "bench.test.nitrogen",
};

export type BenchTestVerdict =
  | StretchVerdict
  | HeatVerdict
  | DissolveVerdict
  | StickVerdict
  | DropVerdict
  | ShotVerdict;

export const BENCH_TEST_STATUS_LABEL_KEYS: Record<BenchTestVerdict, MessageKey> = {
  breaks: "bench.test.status.breaks",
  snaps: "bench.test.status.snaps",
  flows: "bench.test.status.flows",
  "nothing-to-test": "bench.test.status.nothing-to-test",
  "falls-apart": "bench.test.status.falls-apart",
  unsafe: "bench.test.status.unsafe",
  stable: "bench.test.status.stable",
  "dries-out": "bench.test.status.dries-out",
  softens: "bench.test.status.softens",
  melts: "bench.test.status.melts",
  chars: "bench.test.status.chars",
  burns: "bench.test.status.burns",
  dissolves: "bench.test.status.dissolves",
  swells: "bench.test.status.swells",
  "no-change": "bench.test.status.no-change",
  "already-liquid": "bench.test.status.already-liquid",
  sticks: "bench.test.status.sticks",
  weak: "bench.test.status.weak",
  "no-stick": "bench.test.status.no-stick",
  survives: "bench.test.status.survives",
  cracks: "bench.test.status.cracks",
  splats: "bench.test.status.splats",
  splashes: "bench.test.status.splashes",
  scatters: "bench.test.status.scatters",
  shoots: "bench.test.status.shoots",
  "breaks-up": "bench.test.status.breaks-up",
  "falls-short": "bench.test.status.falls-short",
  "too-thick": "bench.test.status.too-thick",
  "sets-in-cartridge": "bench.test.status.sets-in-cartridge",
  "nothing-to-shoot": "bench.test.status.nothing-to-shoot",
};

export const BENCH_VIEWER_TEST_LABEL_KEYS: Record<
  "stretch" | "heat" | "dissolve" | "stick" | "drop",
  MessageKey
> = {
  stretch: "bench.test.stretch",
  heat: "bench.test.heat",
  dissolve: "bench.test.dissolve",
  stick: "bench.test.stick",
  drop: "bench.test.drop",
};

export const BENCH_BOOLEAN_LABEL_KEYS = {
  yes: "bench.yes",
  no: "bench.no",
} as const satisfies Record<"yes" | "no", MessageKey>;

export const REPORT_BOOLEAN_LABEL_KEYS = {
  yes: "report.yes",
  no: "report.no",
} as const satisfies Record<"yes" | "no", MessageKey>;

export const BENCH_CONFIDENCE_LABEL_KEYS = {
  high: "bench.confidenceHigh",
  medium: "bench.confidenceMedium",
  low: "bench.confidenceLow",
} as const satisfies Record<"high" | "medium" | "low", MessageKey>;

export type BenchScenePhaseId = "pour" | "mix" | "react" | "set" | "final";

export const BENCH_SCENE_PHASE_LABEL_KEYS: Record<BenchScenePhaseId, MessageKey> = {
  pour: "bench.viewer.phase.pour",
  mix: "bench.viewer.phase.mix",
  react: "bench.viewer.phase.react",
  set: "bench.viewer.phase.set",
  final: "bench.viewer.phase.final",
};

export function benchCategoryLabel(category: Category, locale: Locale): string {
  return tr(locale, CATEGORY_LABEL_KEYS[category]);
}

export function benchConfidenceLabel(confidence: number, locale: Locale): string {
  const level = confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low";
  return tr(locale, BENCH_CONFIDENCE_LABEL_KEYS[level]);
}

export function benchConfidenceLine(confidence: number, percent: number, locale: Locale): string {
  return tr(locale, "bench.confidenceLine", {
    level: benchConfidenceLabel(confidence, locale),
    percent,
  });
}

export function benchTestStatusLabel(verdict: BenchTestVerdict, locale: Locale): string {
  return tr(locale, BENCH_TEST_STATUS_LABEL_KEYS[verdict]);
}

export function benchBooleanLabel(value: boolean, locale: Locale): string {
  return tr(locale, value ? BENCH_BOOLEAN_LABEL_KEYS.yes : BENCH_BOOLEAN_LABEL_KEYS.no);
}

export function benchScenePhaseBadgeLabel(id: BenchScenePhaseId, locale: Locale): string {
  return tr(locale, BENCH_SCENE_PHASE_LABEL_KEYS[id]);
}
