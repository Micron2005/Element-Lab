import { byId, CureMechanism, Hazard, Ingredient, localizeIngredient } from "./ingredients";
import { DEFAULT_LOCALE, tr, type Locale } from "./i18n";

export interface Part {
  id: string;
  pct: number;
}

export interface Check {
  level: "good" | "warn" | "bad";
  text: string;
}

export interface FormulaResult {
  solidsPct: number;
  tensileMPa: number;
  elongationPct: number;
  tack: number;
  toughnessMJm3: number;
  cure: CureMechanism[];
  cureSeconds: number;
  wetToxicity: Hazard;
  curedToxicity: Hazard;
  skin: Hazard;
  edible: boolean;
  water: "dissolves" | "swells" | "resists";
  dissolveTime: string;
  biodegradable: boolean;
  costPerKg: number;
  densityCured: number;
  environment: string[];
  checks: Check[];
}

const HAZARD_KEYS = [
  "formula.hazard.safe",
  "formula.hazard.mild",
  "formula.hazard.harmful",
  "formula.hazard.toxic",
] as const;
const CURE_KEYS: Record<CureMechanism, Parameters<typeof tr>[1]> = {
  evaporation: "formula.cure.evaporation",
  "ionic-bath": "formula.cure.ionicBath",
  moisture: "formula.cure.moisture",
  anionic: "formula.cure.anionic",
  shear: "formula.cure.shear",
  cooling: "formula.cure.cooling",
  covalent: "formula.cure.covalent",
  none: "formula.cure.none",
};
const WATER_KEYS = {
  dissolves: "formula.water.dissolves",
  swells: "formula.water.swells",
  resists: "formula.water.resists",
} as const;

export const hazardWord = (h: Hazard, locale: Locale = DEFAULT_LOCALE) =>
  tr(locale, HAZARD_KEYS[h]);
export const cureLabel = (cure: CureMechanism, locale: Locale = DEFAULT_LOCALE) =>
  tr(locale, CURE_KEYS[cure]);
export const waterLabel = (water: FormulaResult["water"], locale: Locale = DEFAULT_LOCALE) =>
  tr(locale, WATER_KEYS[water]);

function ingredientName(ingredient: Ingredient, locale: Locale): string {
  return localizeIngredient(ingredient, locale).name;
}

function normalize(parts: Part[]) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.pct), 0) || 1;
  return parts
    .filter((p) => byId[p.id] && p.pct > 0)
    .map((p) => ({ ing: byId[p.id] as Ingredient, w: p.pct / total }));
}

export function analyze(parts: Part[], locale: Locale = DEFAULT_LOCALE): FormulaResult {
  const items = normalize(parts);
  const checks: Check[] = [];
  const solids = items.filter((i) => i.ing.role !== "solvent");
  const solvents = items.filter((i) => i.ing.role === "solvent");
  const solidW = solids.reduce((s, i) => s + i.w, 0);
  const share = (i: { w: number }) => (solidW ? i.w / solidW : 0);

  const polymers = solids.filter((i) => i.ing.tensileMPa !== undefined && i.ing.role !== "filler");
  const polyW = polymers.reduce((s, i) => s + share(i), 0);
  let tensile = polyW
    ? polymers.reduce((s, i) => s + share(i) * (i.ing.tensileMPa ?? 0), 0) / polyW
    : 0;
  let elong = polyW
    ? polymers.reduce((s, i) => s + share(i) * (i.ing.elongationPct ?? 0), 0) / polyW
    : 0;

  if (!polymers.length) {
    checks.push({ level: "bad", text: tr(locale, "formula.check.noPolymer") });
  }

  // Immiscible polymer blends lose strength at the interfaces.
  if (polymers.length > 1) {
    const top = Math.max(...polymers.map(share)) / (polyW || 1);
    if (top < 0.8) {
      tensile *= 0.75;
      checks.push({ level: "warn", text: tr(locale, "formula.check.blend") });
    }
  }

  // Plasticizers trade strength for stretch.
  const plast = solids.filter((i) => i.ing.role === "plasticizer").reduce((s, i) => s + share(i), 0);
  if (plast > 0) {
    tensile *= Math.max(0.15, 1 - 1.8 * plast);
    elong *= 1 + 4 * plast;
    if (plast > 0.35) checks.push({ level: "warn", text: tr(locale, "formula.check.plasticizer") });
  }

  // Fillers reinforce at low loading, embrittle when they clump.
  for (const f of solids.filter((i) => i.ing.role === "filler")) {
    const s = share(f);
    const limit = f.ing.id === "graphene-oxide" ? 0.03 : 0.1;
    const eff = Math.min(s, limit);
    tensile *= 1 + eff * ((f.ing.tensileMPa ?? 0) / Math.max(tensile, 1)) * 0.15;
    if (s > limit) {
      tensile *= Math.max(0.5, 1 - (s - limit) * 3);
      elong *= 0.6;
      checks.push({
        level: "warn",
        text: tr(locale, "formula.check.filler", {
          name: ingredientName(f.ing, locale),
          limit: limit * 100,
        }),
      });
    } else {
      elong *= 1 - s * 2;
    }
  }

  // Crosslinkers: only help if they match a polymer present.
  const presentIds = new Set(items.map((i) => i.ing.id));
  for (const c of items.filter((i) => i.ing.crosslinks)) {
    const matches = c.ing.crosslinks!.filter((id) => presentIds.has(id));
    if (!matches.length) {
      checks.push({
        level: "warn",
        text: tr(locale, "formula.check.crosslinkNoMatch", {
          name: ingredientName(c.ing, locale),
          worksOn: c.ing.crosslinks!.map((id) => {
            const ingredient = byId[id];
            return ingredient ? ingredientName(ingredient, locale) : id;
          }).join(", "),
        }),
      });
      continue;
    }
    const s = share(c);
    if (c.ing.role === "crosslinker") {
      const ideal = s >= 0.005 && s <= 0.08;
      tensile *= ideal ? 1.35 : s > 0.08 ? 1.1 : 1.1;
      elong *= ideal ? 0.75 : 0.5;
      if (s > 0.08) checks.push({
        level: "warn",
        text: tr(locale, "formula.check.crosslinkTooMuch", { name: ingredientName(c.ing, locale) }),
      });
    } else {
      tensile *= 1.1;
    }
  }

  // Polymer without a matching solvent won't flow out of a nozzle.
  for (const p of polymers) {
    if (p.ing.dissolvesIn && solvents.length && !solvents.some((s) => p.ing.dissolvesIn!.includes(s.ing.id))) {
      checks.push({
        level: "bad",
        text: tr(locale, "formula.check.polymerSolvent", {
          name: ingredientName(p.ing, locale),
          solvents: p.ing.dissolvesIn.map((id) => {
            const ingredient = byId[id];
            return ingredient ? ingredientName(ingredient, locale) : id;
          }).join(` ${tr(locale, "formula.list.or")} `),
        }),
      });
    }
    if (p.ing.dissolvesIn && !solvents.length && !p.ing.cure.includes("cooling")) {
      checks.push({
        level: "bad",
        text: tr(locale, "formula.check.solidSolvent", {
          name: ingredientName(p.ing, locale),
          solvents: p.ing.dissolvesIn.map((id) => {
            const ingredient = byId[id];
            return ingredient ? ingredientName(ingredient, locale) : id;
          }).join(` ${tr(locale, "formula.list.or")} `),
        }),
      });
    }
  }

  // Solid content controls viscosity: too thin = droplets, too thick = clog.
  if (solvents.length) {
    const percent = (solidW * 100).toFixed(0);
    if (solidW < 0.05) checks.push({ level: "bad", text: tr(locale, "formula.check.solidsWatery", { percent }) });
    else if (solidW > 0.45) checks.push({ level: "warn", text: tr(locale, "formula.check.solidsThick", { percent }) });
    else checks.push({ level: "good", text: tr(locale, "formula.check.solidsSprayable", { percent }) });
  }

  // Weak-when-wet adjustment.
  const avgWater = polymers.some((p) => p.ing.water === "dissolves") && !items.some((i) => i.ing.crosslinks?.some((id) => polymers.some((p) => p.ing.id === id)))
    ? "dissolves"
    : polymers.some((p) => p.ing.water === "swells") || polymers.some((p) => p.ing.water === "dissolves")
      ? "swells"
      : "resists";

  const tack = Math.min(10, items.reduce((m, i) => Math.max(m, i.ing.tack * Math.min(1, share(i) * 6 + (i.ing.role === "adhesive" ? 0.4 : 0))), 0));
  if (tack < 4) checks.push({ level: "warn", text: tr(locale, "formula.check.lowTack") });

  const cure = Array.from(new Set(items.flatMap((i) => i.ing.cure).filter((c) => c !== "none")));
  let cureSeconds = 3600;
  if (cure.includes("anionic")) cureSeconds = 10;
  else if (cure.includes("ionic-bath")) cureSeconds = 1;
  else if (cure.includes("shear") && solidW > 0.15) cureSeconds = 2;
  else if (cure.includes("evaporation")) {
    const fast = solvents.some((s) => ["ethanol", "hfip"].includes(s.ing.id));
    cureSeconds = fast ? 20 : 120;
  } else if (cure.includes("moisture")) cureSeconds = 300;
  else if (cure.includes("covalent")) cureSeconds = 600;
  else if (cure.includes("cooling")) cureSeconds = 30;
  if (cureSeconds > 30) checks.push({
    level: "warn",
    text: tr(locale, "formula.check.slowCure", { time: fmtTime(cureSeconds, locale) }),
  });

  const wetToxicity = items.reduce<number>((m, i) => Math.max(m, i.w > 0.001 ? i.ing.toxicity : 0), 0) as Hazard;
  const curedToxicity = items
    .filter((i) => i.ing.role !== "solvent")
    .reduce<number>((m, i) => Math.max(m, i.ing.role === "crosslinker" ? Math.min(i.ing.toxicity, 1) : i.ing.toxicity), 0) as Hazard;
  const skin = items.reduce<number>((m, i) => Math.max(m, i.ing.skin), 0) as Hazard;
  const edible = items.every((i) => i.ing.edible);
  if (skin >= 3) checks.push({ level: "bad", text: tr(locale, "formula.check.skin") });
  if (items.some((i) => i.ing.id === "borax")) checks.push({ level: "warn", text: tr(locale, "formula.check.borax") });

  const dissolveTime =
    avgWater === "dissolves" ? tr(locale, "formula.waterTime.dissolves") :
    avgWater === "swells" ? tr(locale, "formula.waterTime.swells") :
    items.every((i) => i.ing.biodegradable) ? tr(locale, "formula.waterTime.biodegradable") :
    tr(locale, "formula.waterTime.durable");
  if (avgWater === "dissolves") checks.push({ level: "warn", text: tr(locale, "formula.check.waterDissolves") });

  const densityCured = solidW
    ? solids.reduce((s, i) => s + share(i) * i.ing.density, 0)
    : 1;
  const costPerKg = items.reduce((s, i) => s + i.w * i.ing.costPerKg, 0);
  const toughnessMJm3 = 0.5 * tensile * (elong / 100);

  const environment: string[] = [];
  if (cure.includes("moisture")) environment.push(tr(locale, "formula.environment.moisture"));
  if (cure.includes("anionic")) environment.push(tr(locale, "formula.environment.anionic"));
  if (cure.includes("evaporation")) environment.push(tr(locale, "formula.environment.evaporation"));
  if (cure.includes("ionic-bath")) environment.push(tr(locale, "formula.environment.ionicBath"));
  if (cure.includes("shear")) environment.push(tr(locale, "formula.environment.shear"));
  if (cure.includes("cooling")) environment.push(tr(locale, "formula.environment.cooling"));
  environment.push(tr(locale, "formula.environment.vacuum"));
  if (solvents.some((s) => s.ing.toxicity >= 2)) environment.push(tr(locale, "formula.environment.toxicSolvent"));

  return {
    solidsPct: solidW * 100,
    tensileMPa: tensile,
    elongationPct: elong,
    tack,
    toughnessMJm3,
    cure,
    cureSeconds,
    wetToxicity,
    curedToxicity,
    skin,
    edible,
    water: avgWater,
    dissolveTime,
    biodegradable: items.every((i) => i.ing.biodegradable),
    costPerKg,
    densityCured,
    environment,
    checks,
  };
}

export function fmtTime(s: number, locale: Locale = DEFAULT_LOCALE) {
  if (s < 60) return `${Math.round(s).toLocaleString(locale === "es" ? "es" : "en-US")} s`;
  if (s < 3600) return `${Math.round(s / 60).toLocaleString(locale === "es" ? "es" : "en-US")} min`;
  return `${(s / 3600).toLocaleString(locale === "es" ? "es" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

export const PRESETS = [
  {
    nameKey: "formula.preset.silkAdhesive",
    name: tr(DEFAULT_LOCALE, "formula.preset.silkAdhesive"),
    parts: [
      { id: "spider-silk", pct: 20 },
      { id: "dopamine", pct: 2 },
      { id: "glycerol", pct: 3 },
      { id: "cnf", pct: 1 },
      { id: "water", pct: 74 },
    ],
  },
  {
    nameKey: "formula.preset.budgetSilk",
    name: tr(DEFAULT_LOCALE, "formula.preset.budgetSilk"),
    parts: [
      { id: "silk-fibroin", pct: 18 },
      { id: "genipin", pct: 0.5 },
      { id: "dopamine", pct: 1.5 },
      { id: "glycerol", pct: 3 },
      { id: "water", pct: 77 },
    ],
  },
  {
    nameKey: "formula.preset.rubber",
    name: tr(DEFAULT_LOCALE, "formula.preset.rubber"),
    parts: [
      { id: "pu", pct: 70 },
      { id: "pib", pct: 25 },
      { id: "cnf", pct: 5 },
    ],
  },
  {
    nameKey: "formula.preset.slime",
    name: tr(DEFAULT_LOCALE, "formula.preset.slime"),
    parts: [
      { id: "pva", pct: 8 },
      { id: "borax", pct: 0.5 },
      { id: "water", pct: 91.5 },
    ],
  },
] satisfies {
  name: string;
  nameKey:
    | "formula.preset.silkAdhesive"
    | "formula.preset.budgetSilk"
    | "formula.preset.rubber"
    | "formula.preset.slime";
  parts: Part[];
}[];
