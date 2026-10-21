import { byId, CureMechanism, Hazard, Ingredient } from "./ingredients";

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

const HAZARD_WORD = ["Safe", "Mild", "Harmful", "Toxic"] as const;
export const hazardWord = (h: Hazard) => HAZARD_WORD[h];

function normalize(parts: Part[]) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.pct), 0) || 1;
  return parts
    .filter((p) => byId[p.id] && p.pct > 0)
    .map((p) => ({ ing: byId[p.id] as Ingredient, w: p.pct / total }));
}

export function analyze(parts: Part[]): FormulaResult {
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
    checks.push({ level: "bad", text: "No structural polymer. Add a polymer (silk, PVA, polyurethane...) or nothing will hold load." });
  }

  // Immiscible polymer blends lose strength at the interfaces.
  if (polymers.length > 1) {
    const top = Math.max(...polymers.map(share)) / (polyW || 1);
    if (top < 0.8) {
      tensile *= 0.75;
      checks.push({ level: "warn", text: "Blend of different polymers: they rarely mix perfectly, so weak boundaries form (about -25% strength). Keep one main polymer above 80%." });
    }
  }

  // Plasticizers trade strength for stretch.
  const plast = solids.filter((i) => i.ing.role === "plasticizer").reduce((s, i) => s + share(i), 0);
  if (plast > 0) {
    tensile *= Math.max(0.15, 1 - 1.8 * plast);
    elong *= 1 + 4 * plast;
    if (plast > 0.35) checks.push({ level: "warn", text: "Too much plasticizer: it'll feel gummy and weak." });
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
      checks.push({ level: "warn", text: `${f.ing.name} above ~${limit * 100}% clumps and makes it brittle.` });
    } else {
      elong *= 1 - s * 2;
    }
  }

  // Crosslinkers: only help if they match a polymer present.
  const presentIds = new Set(items.map((i) => i.ing.id));
  for (const c of items.filter((i) => i.ing.crosslinks)) {
    const matches = c.ing.crosslinks!.filter((id) => presentIds.has(id));
    if (!matches.length) {
      checks.push({ level: "warn", text: `${c.ing.name} has nothing to react with here (works on: ${c.ing.crosslinks!.map((id) => byId[id]?.name ?? id).join(", ")}).` });
      continue;
    }
    const s = share(c);
    if (c.ing.role === "crosslinker") {
      const ideal = s >= 0.005 && s <= 0.08;
      tensile *= ideal ? 1.35 : s > 0.08 ? 1.1 : 1.1;
      elong *= ideal ? 0.75 : 0.5;
      if (s > 0.08) checks.push({ level: "warn", text: `Too much ${c.ing.name}: over-crosslinked chains can't stretch, so it snaps.` });
    } else {
      tensile *= 1.1;
    }
  }

  // Polymer without a matching solvent won't flow out of a nozzle.
  for (const p of polymers) {
    if (p.ing.dissolvesIn && solvents.length && !solvents.some((s) => p.ing.dissolvesIn!.includes(s.ing.id))) {
      checks.push({ level: "bad", text: `${p.ing.name} won't dissolve in your solvent. It needs: ${p.ing.dissolvesIn.map((id) => byId[id]?.name ?? id).join(" or ")}.` });
    }
    if (p.ing.dissolvesIn && !solvents.length && !p.ing.cure.includes("cooling")) {
      checks.push({ level: "bad", text: `${p.ing.name} is a solid; add a solvent (${p.ing.dissolvesIn.map((id) => byId[id]?.name ?? id).join(" or ")}) so it can be sprayed.` });
    }
  }

  // Solid content controls viscosity: too thin = droplets, too thick = clog.
  if (solvents.length) {
    if (solidW < 0.05) checks.push({ level: "bad", text: `Only ${(solidW * 100).toFixed(0)}% solids: too watery, the jet will break into droplets instead of a strand.` });
    else if (solidW > 0.45) checks.push({ level: "warn", text: `${(solidW * 100).toFixed(0)}% solids: very thick, needs high pressure and may clog the nozzle.` });
    else checks.push({ level: "good", text: `${(solidW * 100).toFixed(0)}% solids: sprayable range for a strand.` });
  }

  // Weak-when-wet adjustment.
  const avgWater = polymers.some((p) => p.ing.water === "dissolves") && !items.some((i) => i.ing.crosslinks?.some((id) => polymers.some((p) => p.ing.id === id)))
    ? "dissolves"
    : polymers.some((p) => p.ing.water === "swells") || polymers.some((p) => p.ing.water === "dissolves")
      ? "swells"
      : "resists";

  const tack = Math.min(10, items.reduce((m, i) => Math.max(m, i.ing.tack * Math.min(1, share(i) * 6 + (i.ing.role === "adhesive" ? 0.4 : 0))), 0));
  if (tack < 4) checks.push({ level: "warn", text: "Low stickiness. Add an adhesive (dopamine for wet grip, polyisobutylene for skin-safe tack)." });

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
  if (cureSeconds > 30) checks.push({ level: "warn", text: `Takes ~${fmtTime(cureSeconds)} to set: a strand would still be liquid when it lands. Spider silk sets in under a second from shear and water loss.` });

  const wetToxicity = items.reduce<number>((m, i) => Math.max(m, i.w > 0.001 ? i.ing.toxicity : 0), 0) as Hazard;
  const curedToxicity = items
    .filter((i) => i.ing.role !== "solvent")
    .reduce<number>((m, i) => Math.max(m, i.ing.role === "crosslinker" ? Math.min(i.ing.toxicity, 1) : i.ing.toxicity), 0) as Hazard;
  const skin = items.reduce<number>((m, i) => Math.max(m, i.ing.skin), 0) as Hazard;
  const edible = items.every((i) => i.ing.edible);
  if (skin >= 3) checks.push({ level: "bad", text: "Contains something that burns or glues skin. Not safe to shoot from your wrist." });
  if (items.some((i) => i.ing.id === "borax")) checks.push({ level: "warn", text: "Borax is a reproductive toxicant; fine for toy slime handling, not for constant skin contact." });

  const dissolveTime =
    avgWater === "dissolves" ? "Minutes in water; humidity softens it" :
    avgWater === "swells" ? "Swells and weakens in water over hours; doesn't fully dissolve" :
    items.every((i) => i.ing.biodegradable) ? "Water-resistant; biodegrades over weeks to months" :
    "Water-resistant; lasts years (not biodegradable)";
  if (avgWater === "dissolves") checks.push({ level: "warn", text: "Dissolves in water: rain or sweat will ruin it. Add a matching crosslinker." });

  const densityCured = solidW
    ? solids.reduce((s, i) => s + share(i) * i.ing.density, 0)
    : 1;
  const costPerKg = items.reduce((s, i) => s + i.w * i.ing.costPerKg, 0);
  const toughnessMJm3 = 0.5 * tensile * (elong / 100);

  const environment: string[] = [];
  if (cure.includes("moisture")) environment.push("Mix and store bone-dry under nitrogen or argon (a glovebox or sealed bag). Air humidity starts the cure.");
  if (cure.includes("anionic")) environment.push("Store sealed, dry and slightly acidic; any moisture sets it off inside the cartridge.");
  if (cure.includes("evaporation")) environment.push("Mix in a normal room, then seal airtight so the solvent can't escape. It sets when the solvent evaporates after it leaves the nozzle.");
  if (cure.includes("ionic-bath")) environment.push("Keep the gelling salt in a separate chamber and combine at the nozzle (two-part cartridge), or it gels inside.");
  if (cure.includes("shear")) environment.push("Narrow, tapered nozzle: the stretching flow lines the molecules up, which is what turns silk dope into fiber.");
  if (cure.includes("cooling")) environment.push("Store warm or as a melt; it sets as it cools in the air.");
  environment.push("Degas under vacuum after mixing (a few minutes): bubbles become weak spots in the strand. You do not need to mix inside a vacuum.");
  if (solvents.some((s) => s.ing.toxicity >= 2)) environment.push("Toxic solvent: mix only in a fume hood with gloves and goggles.");

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

export function fmtTime(s: number) {
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

export const PRESETS: { name: string; parts: Part[] }[] = [
  {
    name: "Bio web (silk + mussel glue)",
    parts: [
      { id: "spider-silk", pct: 20 },
      { id: "dopamine", pct: 2 },
      { id: "glycerol", pct: 3 },
      { id: "cnf", pct: 1 },
      { id: "water", pct: 74 },
    ],
  },
  {
    name: "Budget web (fibroin + chitosan)",
    parts: [
      { id: "silk-fibroin", pct: 18 },
      { id: "genipin", pct: 0.5 },
      { id: "dopamine", pct: 1.5 },
      { id: "glycerol", pct: 3 },
      { id: "water", pct: 77 },
    ],
  },
  {
    name: "Stretchy rubber web",
    parts: [
      { id: "pu", pct: 70 },
      { id: "pib", pct: 25 },
      { id: "cnf", pct: 5 },
    ],
  },
  {
    name: "Slime (PVA + borax)",
    parts: [
      { id: "pva", pct: 8 },
      { id: "borax", pct: 0.5 },
      { id: "water", pct: 91.5 },
    ],
  },
];
