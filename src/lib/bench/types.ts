export type Category =
  | "element"
  | "salt"
  | "protein"
  | "enzyme"
  | "polymer"
  | "solvent"
  | "acid-base"
  | "additive"
  | "filler";

export type Tag =
  | "amine"
  | "carboxyl"
  | "phenol"
  | "catechol"
  | "diol"
  | "thiol"
  | "lysine-glutamine"
  | "tyrosine"
  | "protein"
  | "ionic-gelling"
  | "cation-2plus"
  | "cation-3plus"
  | "oxidizer"
  | "water-reactive"
  | "moisture-cure"
  | "thermo-gel"
  | "beta-sheet"
  | "elastomer"
  | "inert";

export type Hazard = 0 | 1 | 2 | 3;
export type WaterBehavior = "dissolves" | "swells" | "resists";
export type Atmosphere = "air" | "nitrogen" | "vacuum";
export type Forming =
  | "beaker"
  | "extrude-air"
  | "extrude-bath"
  | "cast-film"
  | "heat-cure";
export type Product =
  | "nothing"
  | "solution"
  | "gel"
  | "slime"
  | "fiber"
  | "film"
  | "adhesive"
  | "solid"
  | "clumps"
  | "dangerous";
export type EventStatus = "happened" | "partial" | "blocked";

export interface EnzymeParameters {
  optT: number;
  minT: number;
  denatureT: number;
  optPH: number;
  pHRange: [number, number];
  needsO2?: boolean;
}

export interface AcidBase {
  molPerPct: number;
  pKas: number[];
  sites?: number;
  chargeProtonated?: number;
  cations?: number;
}

export interface BenchIngredient {
  id: string;
  name: string;
  category: Category;
  formula: string;
  pubchemName?: string;
  tags: Tag[];
  tensileMPa?: number;
  elongationPct?: number;
  tack: number;
  density: number;
  costPerKg: number;
  toxicity: Hazard;
  skin: Hazard;
  edible: boolean;
  water: WaterBehavior;
  biodegradable: boolean;
  acidBase?: AcidBase;
  viscosityPas?: number;
  surfaceTensionNm?: number;
  volatile?: boolean;
  boilC?: number;
  enzyme?: EnzymeParameters;
  dissolvesOnlyBelowPH?: number;
  notes: string;
  bonding: string;
}

export interface Part {
  id: string;
  pct: number;
}

export interface Conditions {
  tempC: number;
  pressureKPa: number;
  atmosphere: Atmosphere;
  humidityPct: number;
  mixRpm: number;
  mixMinutes: number;
  cureMinutes: number;
  forming: Forming;
  bathId?: string;
}

export interface Experiment {
  parts: Part[];
  conditions: Conditions;
}

export interface ReactionEvent {
  id: string;
  name: string;
  status: EventStatus;
  activity: number;
  mechanism: string;
  reasons: string[];
}

export interface Warning {
  level: "good" | "warn" | "bad";
  text: string;
}

export interface RunResult {
  product: Product;
  productLabel: string;
  summary: string;
  tensileMPa: number;
  elongationPct: number;
  tack: number;
  toughnessMJm3: number;
  setSeconds: number;
  wetToxicity: Hazard;
  curedToxicity: Hazard;
  skin: Hazard;
  edible: boolean;
  water: WaterBehavior;
  dissolveTime: string;
  biodegradable: boolean;
  costPerKg: number;
  effectivePH: number;
  events: ReactionEvent[];
  warnings: Warning[];
  notModelled: string[];
  confidence: number;
}

export interface Goal {
  minTensileMPa?: number;
  minElongationPct?: number;
  minTack?: number;
  maxSetSeconds?: number;
  skinSafe?: boolean;
  edible?: boolean;
  water?: "any" | "resists" | "dissolves";
  maxCostPerKg?: number;
  allowExtremePH?: boolean;
  product?: "any" | "fiber" | "film" | "gel" | "adhesive";
}

export interface FindOptions {
  pool: string[];
  maxIngredients: number;
  budget?: number;
  seed?: number;
  lockConditions?: Partial<Conditions>;
}

export interface Candidate {
  experiment: Experiment;
  result: RunResult;
  score: number;
  why: string[];
}
