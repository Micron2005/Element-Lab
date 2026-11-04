import type { BenchIngredient, Category, Hazard, WaterBehavior } from "./types";
import { tr, type Locale, type MessageKey } from "../i18n";

export const CUSTOM_STORAGE = "elementlab.bench.custom";
export const CUSTOM_PREFIX = "custom-";

export type CustomTrait = "protein" | "diol" | "elastomer";

export interface CustomDraft {
  name: string;
  category: Category;
  formula: string;
  traits: CustomTrait[];
  tensileMPa: string;
  elongationPct: string;
  tack: string;
  density: string;
  liquid: boolean;
  viscosityPas: string;
  boilC: string;
  acidBase: "neutral" | "acid" | "base";
  pKa: string;
  molarMass: string;
  toxicity: Hazard;
  skin: Hazard;
  edible: boolean;
  water: WaterBehavior;
  biodegradable: boolean;
  costPerKg: string;
  notes: string;
}

const categories: Category[] = [
  "element",
  "salt",
  "protein",
  "enzyme",
  "polymer",
  "solvent",
  "acid-base",
  "additive",
  "filler",
];
const customTraits: CustomTrait[] = ["protein", "diol", "elastomer"];
const waterBehaviors: WaterBehavior[] = ["dissolves", "swells", "resists"];

function isCategory(value: unknown): value is Category {
  return categories.includes(value as Category);
}

function isHazard(value: unknown): value is Hazard {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isCustomTrait(value: unknown): value is CustomTrait {
  return customTraits.includes(value as CustomTrait);
}

export function emptyDraft(): CustomDraft {
  return {
    name: "",
    category: "polymer",
    formula: "",
    traits: [],
    tensileMPa: "",
    elongationPct: "",
    tack: "",
    density: "",
    liquid: false,
    viscosityPas: "",
    boilC: "",
    acidBase: "neutral",
    pKa: "",
    molarMass: "",
    toxicity: 0,
    skin: 0,
    edible: false,
    water: "resists",
    biodegradable: false,
    costPerKg: "",
    notes: "",
  };
}

function numberString(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export function draftFromIngredient(i: BenchIngredient): CustomDraft {
  const acidBase = i.acidBase;
  return {
    name: typeof i.name === "string" ? i.name : "",
    category: i.category,
    formula: typeof i.formula === "string" ? i.formula : "",
    traits: Array.isArray(i.tags) ? i.tags.filter(isCustomTrait) : [],
    tensileMPa: numberString(i.tensileMPa),
    elongationPct: numberString(i.elongationPct),
    tack: numberString(i.tack),
    density: numberString(i.density),
    liquid: i.viscosityPas !== undefined,
    viscosityPas: numberString(i.viscosityPas),
    boilC: numberString(i.boilC),
    acidBase: !acidBase ? "neutral" : acidBase.chargeProtonated === 1 ? "base" : "acid",
    pKa: numberString(acidBase?.pKas[0]),
    molarMass: numberString(
      acidBase && acidBase.molPerPct > 0 ? 10 / acidBase.molPerPct : undefined,
    ),
    toxicity: i.toxicity,
    skin: i.skin,
    edible: i.edible,
    water: i.water,
    biodegradable: i.biodegradable,
    costPerKg: numberString(i.costPerKg),
    notes: typeof i.notes === "string" ? i.notes : "",
  };
}

export function newCustomId(): string {
  const suffix = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join("");
  return `${CUSTOM_PREFIX}${Date.now().toString(36)}${suffix}`;
}

type DraftValidation =
  | { ingredient: BenchIngredient }
  | { errors: Partial<Record<keyof CustomDraft, string>> };

export function validateCustomDraft(
  draft: CustomDraft,
  id: string,
  locale: Locale = "en",
): DraftValidation {
  const message = (key: MessageKey) => tr(locale, key);
  const errors: Partial<Record<keyof CustomDraft, string>> = {};
  const name = typeof draft.name === "string" ? draft.name.trim() : "";
  const formula = typeof draft.formula === "string" ? draft.formula.trim() : "";
  const notes = typeof draft.notes === "string" ? draft.notes.trim() : "";

  if (name.length === 0) errors.name = message("bench.custom.validation.nameRequired");
  else if (name.length > 40) errors.name = message("bench.custom.validation.nameLength");
  if (!isCategory(draft.category)) errors.category = message("bench.custom.validation.category");
  if (formula.length > 30) errors.formula = message("bench.custom.validation.formulaLength");
  if (notes.length > 300) errors.notes = message("bench.custom.validation.notesLength");
  if (!Array.isArray(draft.traits) || draft.traits.some((trait) => !isCustomTrait(trait))) {
    errors.traits = message("bench.custom.validation.traits");
  }
  if (!isHazard(draft.toxicity)) errors.toxicity = message("bench.custom.validation.toxicity");
  if (!isHazard(draft.skin)) errors.skin = message("bench.custom.validation.skin");
  if (!waterBehaviors.includes(draft.water)) errors.water = message("bench.custom.validation.water");
  if (typeof draft.liquid !== "boolean") errors.liquid = message("bench.custom.validation.liquid");
  if (typeof draft.edible !== "boolean") errors.edible = message("bench.custom.validation.edible");
  if (typeof draft.biodegradable !== "boolean") {
    errors.biodegradable = message("bench.custom.validation.biodegradable");
  }
  if (!["neutral", "acid", "base"].includes(draft.acidBase)) {
    errors.acidBase = message("bench.custom.validation.acidBase");
  }

  const readNumber = (
    field: keyof CustomDraft,
    value: string,
    min: number,
    max: number,
    message: string,
    required = false,
  ): number | undefined => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) {
      if (required) errors[field] = message;
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      errors[field] = message;
      return undefined;
    }
    return parsed;
  };

  const tensileMPa = readNumber(
    "tensileMPa",
    draft.tensileMPa,
    0,
    1500,
    message("bench.custom.validation.strength"),
  );
  const elongationPct = readNumber(
    "elongationPct",
    draft.elongationPct,
    0,
    2000,
    message("bench.custom.validation.stretch"),
  );
  const tack = readNumber("tack", draft.tack, 0, 10, message("bench.custom.validation.stickiness")) ?? 0;
  const density = readNumber(
    "density",
    draft.density,
    0.05,
    25,
    message("bench.custom.validation.density"),
    true,
  );
  const viscosityPas = draft.liquid
    ? readNumber(
        "viscosityPas",
        draft.viscosityPas,
        0.0001,
        1_000_000,
        message("bench.custom.validation.thickness"),
        true,
      )
    : undefined;
  const boilC = draft.category === "solvent"
    ? readNumber("boilC", draft.boilC, -270, 1000, message("bench.custom.validation.boilingPoint"))
    : undefined;
  const costPerKg = readNumber(
    "costPerKg",
    draft.costPerKg,
    0,
    100_000,
    message("bench.custom.validation.cost"),
  ) ?? 0;

  let acidBase: BenchIngredient["acidBase"];
  if (draft.acidBase !== "neutral") {
    const pKa = readNumber("pKa", draft.pKa, 0, 14, message("bench.custom.validation.pKa"), true);
    const molarMass = readNumber(
      "molarMass",
      draft.molarMass,
      1,
      1_000_000,
      message("bench.custom.validation.molarMass"),
      true,
    );
    if (pKa !== undefined && molarMass !== undefined) {
      acidBase = {
        molPerPct: 10 / molarMass,
        pKas: [pKa],
        ...(draft.acidBase === "base" ? { chargeProtonated: 1 } : {}),
      };
    }
  }

  if (Object.keys(errors).length > 0 || density === undefined) return { errors };

  const ingredient: BenchIngredient = {
    id,
    name,
    category: draft.category,
    formula,
    tags: draft.traits.filter(isCustomTrait),
    tensileMPa,
    elongationPct,
    tack,
    density,
    costPerKg,
    toxicity: draft.toxicity,
    skin: draft.skin,
    edible: draft.edible,
    water: draft.water,
    biodegradable: draft.biodegradable,
    acidBase,
    viscosityPas,
    surfaceTensionNm: undefined,
    volatile: draft.category === "solvent",
    boilC,
    notes: notes || tr(locale, "bench.custom.notesDefault"),
    bonding: tr(locale, "bench.custom.bondingDefault"),
  };
  return { ingredient };
}

export function parseStoredCustom(raw: unknown): BenchIngredient[] {
  if (!Array.isArray(raw)) return [];
  const parsed: BenchIngredient[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    try {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const item = value as BenchIngredient;
      if (typeof item.id !== "string" || !item.id.startsWith(CUSTOM_PREFIX) || seen.has(item.id)) {
        continue;
      }
      const validated = validateCustomDraft(draftFromIngredient(item), item.id);
      if ("ingredient" in validated) {
        parsed.push(validated.ingredient);
        seen.add(item.id);
      }
    } catch {
      continue;
    }
  }
  return parsed;
}
