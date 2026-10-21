import { benchById } from "./library";
import type {
  BenchIngredient,
  EventStatus,
  Experiment,
  Hazard,
  Product,
} from "./types";

export interface ReactionContext {
  experiment: Experiment;
  present: Set<string>;
  effectivePH: number;
  waterPct: number;
  amount: (id: string) => number;
  ingredient: (id: string) => BenchIngredient | undefined;
}

export interface ReactionEffects {
  tensileMultiplier?: number;
  elongationMultiplier?: number;
  tackDelta?: number;
  toughnessMultiplier?: number;
  wetToxicity?: Hazard;
  skin?: Hazard;
  product?: Product;
  note?: string;
}

export interface Reaction {
  id: string;
  name: string;
  needs: (experiment: Experiment, present: Set<string>) => boolean;
  fit: (ctx: ReactionContext) => { activity: number; reasons: string[] };
  network: number;
  networkFor?: (ctx: ReactionContext) => number;
  setSeconds: number;
  effects: ReactionEffects;
  mechanism: string;
}

export interface EvaluatedReaction {
  reaction: Reaction;
  activity: number;
  status: EventStatus;
  reasons: string[];
  setSeconds: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const hasAny = (present: Set<string>, ids: string[]) =>
  ids.some((id) => present.has(id));
const hasProtein = (ctx: ReactionContext) =>
  [...ctx.present].some((id) => benchById[id]?.tags.includes("protein"));

export function windowActivity(
  value: number,
  min: number,
  max: number,
  margin = 1,
): number {
  if (value >= min && value <= max) return 1;
  if (value < min) return margin <= 0 ? 0 : clamp01(1 - (min - value) / margin);
  return margin <= 0 ? 0 : clamp01(1 - (value - max) / margin);
}

function pHActivity(
  pH: number,
  range: [number, number],
  optimum: number,
): number {
  const [low, high] = range;
  if (pH < low || pH > high) return 0;
  if (pH === optimum) return 1;
  if (pH < optimum) return optimum === low ? 1 : clamp01((pH - low) / (optimum - low));
  return high === optimum ? 1 : clamp01((high - pH) / (high - optimum));
}

export function enzymeActivity(
  ingredient: BenchIngredient,
  ctx: ReactionContext,
): { activity: number; reasons: string[] } {
  const enzyme = ingredient.enzyme;
  if (!enzyme) return { activity: 0, reasons: ["enzyme parameters are not defined"] };
  const reasons: string[] = [];
  const temp = ctx.experiment.conditions.tempC;
  let temperatureFactor = 0;
  if (temp < enzyme.minT) {
    reasons.push(`below minimum temperature (${enzyme.minT} °C)`);
  } else if (temp >= enzyme.denatureT) {
    reasons.push(`denatured at ${temp} °C`);
  } else if (temp <= enzyme.optT) {
    temperatureFactor =
      enzyme.optT === enzyme.minT
        ? 1
        : (temp - enzyme.minT) / (enzyme.optT - enzyme.minT);
  } else {
    temperatureFactor =
      enzyme.denatureT === enzyme.optT
        ? 0
        : (enzyme.denatureT - temp) / (enzyme.denatureT - enzyme.optT);
  }

  const phFactor = pHActivity(ctx.effectivePH, enzyme.pHRange, enzyme.optPH);
  if (phFactor === 0) {
    reasons.push(`pH outside enzyme range ${enzyme.pHRange[0]}–${enzyme.pHRange[1]}`);
  }
  let oxygenFactor = 1;
  if (enzyme.needsO2 && ctx.experiment.conditions.atmosphere !== "air") {
    oxygenFactor = 0;
    reasons.push("needs oxygen; atmosphere is not air");
  }
  let waterFactor = 1;
  if (ctx.waterPct < 30) {
    waterFactor = 0.2;
    reasons.push("too dry for the enzyme");
  }

  return {
    activity: clamp01(temperatureFactor * phFactor * oxygenFactor * waterFactor),
    reasons,
  };
}

const rule = (
  value: Reaction,
): Reaction => value;

const amineTargets = ["chitosan", "gelatin", "collagen", "casein"];
const proteinTargets = [
  "gelatin",
  "casein",
  "whey-protein",
  "soy-protein",
  "collagen",
  "silk-fibroin",
  "keratin",
];
const glutaraldehydeTargets = [
  "chitosan",
  "gelatin",
  "collagen",
  "casein",
  "mfp5",
  "dopamine",
  "keratin",
];
const catecholTargets = ["silk-fibroin", "mfp5", "gelatin", "dopamine"];
const fillerIds = ["graphene", "cnt", "silica", "cnf", "graphene-oxide", "gold-np", "silver-np"];
const acidIds = ["acetic-acid", "formic-acid", "citric-acid"];

function enzymeFit(
  ctx: ReactionContext,
  enzymeIds: string[],
): { activity: number; reasons: string[]; selected?: string } {
  const candidates = enzymeIds
    .filter((id) => ctx.present.has(id))
    .map((id) => ({ id, ...enzymeActivity(benchById[id], ctx) }))
    .sort((a, b) => b.activity - a.activity);
  const best = candidates[0];
  return best
    ? { activity: best.activity, reasons: best.reasons, selected: best.id }
    : { activity: 0, reasons: ["required enzyme is missing"] };
}

function crosslinkProteinFactor(ctx: ReactionContext): number {
  let factor = 0;
  for (const id of proteinTargets) {
    if (!ctx.present.has(id)) continue;
    factor = Math.max(
      factor,
      id === "silk-fibroin" ? 0.4 : id === "keratin" ? 0.3 : 1,
    );
  }
  return clamp01(factor);
}

function oxidaseTargetFactor(ctx: ReactionContext): number {
  let factor = 0;
  for (const id of catecholTargets) {
    if (!ctx.present.has(id)) continue;
    factor = Math.max(factor, id === "gelatin" ? 0.3 : 1);
  }
  return clamp01(factor);
}

function proteinaseTargetFactor(ctx: ReactionContext): number {
  const protein = [...ctx.present].some((id) => benchById[id]?.tags.includes("protein"));
  const otherEnzyme = [...ctx.present].some(
    (id) => benchById[id]?.category === "enzyme" && !["trypsin", "papain", "proteinase-k"].includes(id),
  );
  return protein || otherEnzyme ? 1 : 0;
}

export const REACTIONS: Reaction[] = [
  rule({
    id: "alginate-calcium",
    name: "Alginate–calcium",
    needs: (_exp, present) =>
      present.has("alginate") &&
      (present.has("cacl2") || (present.has("caco3") && present.has("alginate"))),
    fit: (ctx) => {
      const calciumCarbonateOnly = ctx.present.has("caco3") && !ctx.present.has("cacl2");
      const calciumAvailable = ctx.present.has("cacl2") || ctx.effectivePH < 6;
      const ph = windowActivity(ctx.effectivePH, 4, 10, 1);
      let activity = calciumAvailable ? ph : 0;
      const reasons: string[] = [];
      if (calciumCarbonateOnly && ctx.effectivePH >= 6) {
        reasons.push("calcium carbonate supplies modeled calcium only below pH 6");
      }
      if (ph === 0) reasons.push("pH outside the alginate crosslink window");
      if (ctx.present.has("sodium-citrate")) {
        activity *= 0.2;
        reasons.push("citrate pulls the calcium back out");
      }
      return { activity, reasons };
    },
    network: 0.7,
    setSeconds: 5,
    effects: {},
    mechanism: "Calcium ions form egg-box ionic junctions between alginate chains.",
  }),
  rule({
    id: "alginate-fe-zn",
    name: "Alginate–iron or zinc",
    needs: (_exp, present) =>
      present.has("alginate") && (present.has("fecl3") || present.has("zncl2")),
    fit: (ctx) => {
      const ph = windowActivity(ctx.effectivePH, 4, 10, 1);
      const reasons = ph === 0 ? ["pH outside the alginate crosslink window"] : [];
      return { activity: ph, reasons };
    },
    network: 0.8,
    networkFor: (ctx) => (ctx.present.has("fecl3") ? 0.8 : 0.5),
    setSeconds: 5,
    effects: {},
    mechanism: "Iron or zinc ions form ionic junctions between alginate chains.",
  }),
  rule({
    id: "borax-pva",
    name: "Borax–PVA slime",
    needs: (_exp, present) =>
      present.has("borax") &&
      [...present].some(
        (id) =>
          benchById[id]?.category === "polymer" &&
          benchById[id]?.tags.includes("diol"),
      ),
    fit: (ctx) => {
      const phFactor = ctx.effectivePH >= 8
        ? 1
        : ctx.effectivePH <= 7
          ? 0
          : ctx.effectivePH - 7;
      return {
        activity: phFactor,
        reasons: phFactor === 0 ? ["effective pH must reach 8; activity falls to zero at pH 7"] : [],
      };
    },
    network: 0.35,
    setSeconds: 10,
    effects: {
      tensileMultiplier: 1.1,
      elongationMultiplier: 2,
      tackDelta: 2,
      note: "Reversible borate links can self-heal after being stretched.",
    },
    mechanism: "Borate ions reversibly bridge diol groups along PVA chains.",
  }),
  rule({
    id: "transglutaminase",
    name: "Transglutaminase protein crosslinking",
    needs: (_exp, present) =>
      present.has("transglutaminase") && hasAny(present, proteinTargets),
    fit: (ctx) => {
      const enzyme = enzymeActivity(benchById.transglutaminase, ctx);
      const target = crosslinkProteinFactor(ctx);
      const activity = enzyme.activity * target;
      const reasons = [...enzyme.reasons];
      if (target === 0) reasons.push("no compatible lysine-glutamine protein is present");
      if (target < 1 && target > 0) reasons.push("protein-specific crosslink activity is reduced");
      return { activity, reasons };
    },
    network: 0.6,
    setSeconds: 1800,
    effects: {},
    mechanism: "Transglutaminase forms covalent isopeptide links between protein chains.",
  }),
  rule({
    id: "phenol-oxidase",
    name: "Tyrosinase or laccase crosslinking",
    needs: (_exp, present) =>
      hasAny(present, ["tyrosinase", "laccase"]) && hasAny(present, catecholTargets),
    fit: (ctx) => {
      const enzyme = enzymeFit(ctx, ["tyrosinase", "laccase"]);
      const target = oxidaseTargetFactor(ctx);
      const activity = enzyme.activity * target;
      const reasons = [...enzyme.reasons];
      if (target === 0) reasons.push("no compatible phenol, catechol, or tyrosine group is present");
      if (target < 1 && target > 0) reasons.push("gelatin crosslink contribution is reduced");
      return { activity, reasons };
    },
    network: 0.5,
    setSeconds: 600,
    effects: { tackDelta: 3 },
    mechanism: "Oxidized phenol and catechol groups form adhesive quinone links.",
  }),
  rule({
    id: "hrp-crosslinking",
    name: "HRP peroxide crosslinking",
    needs: (_exp, present) =>
      present.has("hrp") &&
      present.has("hydrogen-peroxide") &&
      hasAny(present, ["silk-fibroin", "mfp5", "gelatin", "dopamine"]),
    fit: (ctx) => {
      const enzyme = enzymeActivity(benchById.hrp, ctx);
      const peroxide = ctx.amount("hydrogen-peroxide");
      const reasons = [...enzyme.reasons];
      let peroxideFactor = 1;
      if (peroxide < 0.05) {
        peroxideFactor = 0;
        reasons.push("hydrogen peroxide must be at least 0.05% of the mix");
      } else if (peroxide > 1) {
        peroxideFactor = 0.3;
        reasons.push("too much peroxide inactivates the enzyme");
      }
      const target = oxidaseTargetFactor(ctx);
      if (target === 0) reasons.push("no compatible phenol or tyrosine group is present");
      return { activity: enzyme.activity * peroxideFactor * target, reasons };
    },
    network: 0.55,
    setSeconds: 30,
    effects: {},
    mechanism: "HRP uses a small amount of peroxide to couple compatible groups.",
  }),
  rule({
    id: "catechol-oxidation",
    name: "Catechol oxidation",
    needs: (_exp, present) => hasAny(present, ["dopamine", "mfp5"]),
    fit: (ctx) => {
      const reasons: string[] = [];
      let activity = 1;
      if (ctx.effectivePH < 7.5) {
        activity = 0;
        reasons.push("effective pH must be at least 7.5");
      }
      if (ctx.experiment.conditions.atmosphere !== "air") {
        activity = 0;
        reasons.push("catechol oxidation needs oxygen; atmosphere is not air");
      }
      return { activity, reasons };
    },
    network: 0,
    setSeconds: 600,
    effects: { tackDelta: 4, note: "Wet adhesion is improved by quinone formation." },
    mechanism: "Oxygen oxidizes catechol groups into adhesive quinones.",
  }),
  rule({
    id: "catechol-iron",
    name: "Catechol–iron coordination",
    needs: (_exp, present) =>
      hasAny(present, ["dopamine", "mfp5"]) && present.has("fecl3"),
    fit: (ctx) => {
      if (ctx.effectivePH < 7.5) {
        return {
          activity: 0.4,
          reasons: ["lower pH favors weaker mono/bis coordination (activity ×0.4)"],
        };
      }
      const factor = windowActivity(ctx.effectivePH, 7.5, 9, 1);
      return {
        activity: factor,
        reasons: factor === 0 ? ["outside the pH 7.5–9 coordination window"] : [],
      };
    },
    network: 0.6,
    setSeconds: 60,
    effects: { toughnessMultiplier: 2, note: "Mussel-byssus-like coordination can self-heal." },
    mechanism: "Iron(III) coordinates with catechol groups to make reversible junctions.",
  }),
  rule({
    id: "genipin-amine",
    name: "Genipin protein crosslinking",
    needs: (_exp, present) => present.has("genipin") && hasAny(present, amineTargets),
    fit: (ctx) => {
      const factor = windowActivity(ctx.experiment.conditions.tempC, 20, 45, 5);
      return {
        activity: factor,
        reasons: factor === 0 ? ["genipin crosslinking is modeled at 20–45 °C"] : [],
      };
    },
    network: 0.45,
    setSeconds: 14400,
    effects: { note: "Genipin-crosslinked material is modeled as blue-tinted and low-toxicity." },
    mechanism: "Genipin links compatible amine groups in proteins and chitosan.",
  }),
  rule({
    id: "glutaraldehyde-amine",
    name: "Glutaraldehyde amine crosslinking",
    needs: (_exp, present) =>
      present.has("glutaraldehyde") && hasAny(present, glutaraldehydeTargets),
    fit: () => ({ activity: 1, reasons: [] }),
    network: 0.6,
    setSeconds: 300,
    effects: { wetToxicity: 3, skin: 3 },
    mechanism: "Glutaraldehyde forms covalent links between amine-bearing chains.",
  }),
  rule({
    id: "chitosan-solubility",
    name: "Chitosan solubility and polyelectrolyte complex",
    needs: (_exp, present) => present.has("chitosan"),
    fit: (ctx) => {
      if (ctx.effectivePH > 6.5) {
        return {
          activity: 0,
          reasons: ["chitosan does not dissolve above pH 6.5; add acetic acid to dissolve it"],
        };
      }
      if (ctx.present.has("alginate")) return { activity: 1, reasons: [] };
      if (
        ctx.present.has("sodium-citrate") &&
        ctx.experiment.conditions.forming === "extrude-bath"
      ) {
        return { activity: 1, reasons: ["sodium citrate bath forms the modeled chitosan fiber network"] };
      }
      return { activity: 0, reasons: ["chitosan is dissolved; no alginate or ionic bath partner is present"] };
    },
    network: 0.4,
    setSeconds: 60,
    effects: {},
    mechanism: "Dissolved chitosan and alginate form a polyelectrolyte complex at their interface.",
  }),
  rule({
    id: "gelatin-thermogel",
    name: "Gelatin thermo-gel",
    needs: (_exp, present) => present.has("gelatin"),
    fit: (ctx) => {
      const covalentlyCrosslinked =
        (ctx.present.has("transglutaminase") &&
          enzymeActivity(benchById.transglutaminase, ctx).activity > 0) ||
        (ctx.present.has("genipin") &&
          ctx.experiment.conditions.tempC >= 20 &&
          ctx.experiment.conditions.tempC <= 45) ||
        ctx.present.has("glutaraldehyde");
      const temp = ctx.experiment.conditions.tempC;
      if (temp < 25) return { activity: 1, reasons: ["cooling below 25 °C forms the gel"] };
      if (temp > 35 && !covalentlyCrosslinked) {
        return {
          activity: 0,
          reasons: ["above 35 °C gelatin is liquid unless covalently crosslinked"],
        };
      }
      if (temp > 35) return { activity: 1, reasons: ["covalent crosslinks keep the gel set"] };
      return { activity: (35 - temp) / 10, reasons: ["gel strength increases as it cools below 35 °C"] };
    },
    network: 0,
    setSeconds: 0,
    effects: { note: "Uncrosslinked gelatin melts near body temperature." },
    mechanism: "Cooling lets gelatin chains associate into a reversible physical gel.",
  }),
  rule({
    id: "silk-beta-sheet",
    name: "Silk β-sheet formation",
    needs: (_exp, present) => hasAny(present, ["spider-silk", "silk-fibroin"]),
    fit: (ctx) => {
      const { conditions } = ctx.experiment;
      const triggered =
        conditions.mixRpm >= 800 ||
        conditions.forming.startsWith("extrude-") ||
        hasAny(ctx.present, ["ethanol", "methanol"]) ||
        conditions.bathId === "ethanol" ||
        conditions.bathId === "methanol" ||
        ctx.effectivePH < 5 ||
        ctx.present.has("kcl");
      return triggered
        ? { activity: 1, reasons: ["shear, solvent exchange, low pH, or potassium chloride triggers β-sheets"] }
        : { activity: 0, reasons: ["no β-sheet trigger; silk stays a weak solution or gel"] };
    },
    network: 0.8,
    setSeconds: 0,
    effects: { tensileMultiplier: 1.4 },
    mechanism: "Silk chains assemble into stronger β-sheet-rich regions.",
  }),
  rule({
    id: "cyanoacrylate",
    name: "Cyanoacrylate curing",
    needs: (_exp, present) => present.has("cyanoacrylate"),
    fit: (ctx) => {
      if (ctx.waterPct > 0 || hasAny(ctx.present, ["acetic-acid", "formic-acid"])) {
        return {
          activity: 1,
          reasons: ["water or aqueous ingredient starts curing inside the mix or cartridge"],
        };
      }
      if (
        ctx.experiment.conditions.atmosphere === "air" &&
        ctx.experiment.conditions.humidityPct >= 20
      ) {
        return { activity: 1, reasons: ["humidity in air starts the cure on exposure"] };
      }
      return {
        activity: 0,
        reasons: ["dry nitrogen or vacuum prevents the humidity-triggered cure"],
      };
    },
    network: 0,
    setSeconds: 2,
    effects: { product: "clumps" },
    mechanism: "Moisture starts rapid anionic polymerization of cyanoacrylate.",
  }),
  rule({
    id: "pu-moisture-cure",
    name: "Polyurethane moisture cure",
    needs: (_exp, present) => present.has("pu"),
    fit: (ctx) => {
      const humidity = ctx.experiment.conditions.atmosphere === "nitrogen"
        ? Math.min(5, ctx.experiment.conditions.humidityPct)
        : ctx.experiment.conditions.humidityPct;
      if (ctx.experiment.conditions.atmosphere === "vacuum") {
        return { activity: 0, reasons: ["vacuum disables moisture curing"] };
      }
      if (ctx.experiment.conditions.atmosphere !== "air" || humidity < 30) {
        return { activity: 0, reasons: ["moisture cure needs air and at least 30% humidity"] };
      }
      return {
        activity: clamp01((humidity - 20) / 50),
        reasons: [],
      };
    },
    network: 0.5,
    setSeconds: 600,
    effects: { wetToxicity: 3 },
    mechanism: "Atmospheric moisture reacts with the prepolymer and builds a urethane network.",
  }),
  rule({
    id: "latex-cure",
    name: "Latex coagulation and vulcanization",
    needs: (_exp, present) => present.has("latex"),
    fit: (ctx) => {
      const { conditions } = ctx.experiment;
      if (ctx.present.has("sulfur")) {
        const threshold = ctx.present.has("zno") ? 120 : 140;
        if (conditions.tempC >= threshold && conditions.cureMinutes >= 10) {
          return { activity: 1, reasons: ["heat and cure time enable sulfur vulcanization"] };
        }
        return {
          activity: 0,
          reasons: ["nothing happens until heated; sulfur needs the cure temperature and 10 minutes"],
        };
      }
      if (ctx.effectivePH < 5 || ctx.present.has("cacl2") || ctx.present.has("caco3")) {
        return { activity: 1, reasons: ["acid or calcium ions coagulate the latex"] };
      }
      return { activity: 0, reasons: ["no acid, calcium ion, or heated sulfur cure is present"] };
    },
    network: 0.3,
    networkFor: (ctx) => {
      const threshold = ctx.present.has("zno") ? 120 : 140;
      return ctx.present.has("sulfur") &&
        ctx.experiment.conditions.tempC >= threshold &&
        ctx.experiment.conditions.cureMinutes >= 10
        ? 0.8
        : 0.3;
    },
    setSeconds: 600,
    effects: {},
    mechanism: "Acid or calcium coagulates latex; heated sulfur makes vulcanizing crosslinks.",
  }),
  rule({
    id: "protease-digestion",
    name: "Protease digestion",
    needs: (_exp, present) =>
      hasAny(present, ["trypsin", "papain", "proteinase-k"]) &&
      (hasProtein({ present } as ReactionContext) ||
        [...present].some((id) => benchById[id]?.category === "enzyme")),
    fit: (ctx) => {
      const enzyme = enzymeFit(ctx, ["trypsin", "papain", "proteinase-k"]);
      const target = proteinaseTargetFactor(ctx);
      const reasons = [...enzyme.reasons];
      if (target === 0) reasons.push("no protein or other enzyme is present");
      if (enzyme.activity > 0 && target > 0) {
        reasons.push("protease digests the proteins (and the other enzymes)");
      }
      return { activity: enzyme.activity * target, reasons };
    },
    network: 0,
    setSeconds: 0,
    effects: {},
    mechanism: "Protease enzymes cut protein chains and can digest other enzymes.",
  }),
  rule({
    id: "sodium-water",
    name: "Sodium metal and water",
    needs: (_exp, present) =>
      present.has("sodium-metal") &&
      hasAny(present, ["water", "acetic-acid", "formic-acid", "citric-acid"]),
    fit: () => ({ activity: 1, reasons: ["violent reaction; hydrogen fire risk"] }),
    network: 0,
    setSeconds: 0,
    effects: { wetToxicity: 3, skin: 3, product: "dangerous" },
    mechanism: "Sodium reacts violently with water, releasing hydrogen and forming sodium hydroxide.",
  }),
  rule({
    id: "bicarbonate-bubbles",
    name: "Acid and bicarbonate bubbling",
    needs: (_exp, present) =>
      present.has("sodium-bicarbonate") && hasAny(present, acidIds),
    fit: () => ({ activity: 1, reasons: ["carbon dioxide bubbles can leave defects"] }),
    network: 0,
    setSeconds: 0,
    effects: { tensileMultiplier: 0.8 },
    mechanism: "Acid and bicarbonate release carbon dioxide bubbles.",
  }),
  rule({
    id: "filler-reinforcement",
    name: "Filler reinforcement",
    needs: (_exp, present) =>
      (hasAny(present, fillerIds) &&
        [...present].some((id) =>
          ["protein", "polymer"].includes(benchById[id]?.category ?? ""),
        )) ||
      (present.has("iron-powder") && hasAny(present, acidIds)),
    fit: (ctx) =>
      ctx.present.has("iron-powder") && hasAny(ctx.present, acidIds)
        ? { activity: 1, reasons: ["iron can release hydrogen gas in acid"] }
        : { activity: 1, reasons: [] },
    network: 0,
    setSeconds: 0,
    effects: {},
    mechanism:
      "Dispersed fillers reinforce a matrix until agglomeration dominates; iron powder can release hydrogen gas in acid.",
  }),
];

export function statusForActivity(activity: number): EventStatus {
  if (activity <= 0) return "blocked";
  return activity >= 0.8 ? "happened" : "partial";
}
