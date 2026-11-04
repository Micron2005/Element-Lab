import { effectivePH, solventBoilingPointC, waterBoilingPointC } from "./conditions";
import { CUSTOM_PREFIX } from "./custom";
import { benchById, localizeBenchIngredient } from "./library";
import { DEFAULT_LOCALE, tr, type Locale, type MessageKey } from "../i18n";
import {
  localizeReaction,
  localizeReactionEvent,
  REACTIONS,
  statusForActivity,
  type EvaluatedReaction,
  type ReactionContext,
} from "./reactions";
import type {
  Experiment,
  Product,
  ReactionEvent,
  RunResult,
  Warning,
} from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const roundTo = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
const partAmount = (experiment: Experiment, id: string) =>
  experiment.parts.reduce((total, part) => total + (part.id === id ? Math.max(0, part.pct) : 0), 0);

const solutionSolvents: Record<string, string[]> = {
  "spider-silk": ["water", "hfip"],
  "silk-fibroin": ["water", "hfip"],
  pva: ["water"],
  alginate: ["water"],
  chitosan: ["water"],
  gelatin: ["water"],
  mfp5: ["water"],
  collagen: ["water", "hfip"],
  casein: ["water"],
  "whey-protein": ["water"],
  "soy-protein": ["water"],
  zein: ["ethanol", "hfip"],
  keratin: ["hfip"],
  "hyaluronic-acid": ["water"],
  nylon66: ["hfip"],
};
const solventExemptions = new Set(["latex", "pu", "cyanoacrylate", "pib"]);

export function matchingSolventIds(id: string, ph = 7): string[] {
  if (id === "chitosan" && ph > 6.5) return [];
  return solutionSolvents[id] ?? [];
}

export function requiresSolutionSolvent(id: string, forming: Experiment["conditions"]["forming"]): boolean {
  if (solventExemptions.has(id) || (id === "nylon66" && forming === "heat-cure")) {
    return false;
  }
  return id in solutionSolvents;
}

export function matchingSolventPct(experiment: Experiment, id: string, ph = 7): number {
  const solvents = new Set(matchingSolventIds(id, ph));
  return experiment.parts.reduce(
    (total, part) => total + (solvents.has(part.id) ? Math.max(0, part.pct) : 0),
    0,
  );
}

function productLabel(product: Product, locale: Locale): string {
  const keys: Record<Product, MessageKey> = {
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
  return tr(locale, keys[product]);
}

function reactionName(
  id: string,
  context: ReactionContext,
  locale: Locale,
): string {
  if (
    id === "filler-reinforcement" &&
    context.present.has("iron-powder") &&
    acidIdsForPairs.some((acid) => context.present.has(acid))
  ) {
    const matrix = [...context.present].some(
      (ingredientId) =>
        ["protein", "polymer"].includes(benchById[ingredientId]?.category ?? "") &&
        ["graphene", "cnt", "silica", "cnf", "graphene-oxide", "gold-np", "silver-np"].some(
          (filler) => context.present.has(filler),
        ),
    );
    if (matrix) return tr(locale, "bench.reaction.name.fillerIronAcid");
    return tr(locale, "bench.reaction.name.ironAcid");
  }
  if (id === "alginate-fe-zn") {
    if (context.present.has("fecl3")) return tr(locale, "bench.reaction.name.alginateIronThree");
    return tr(locale, "bench.reaction.name.alginateZinc");
  }
  if (id === "phenol-oxidase") {
    return tr(locale, context.present.has("tyrosinase")
      ? "bench.reaction.name.tyrosinaseOxidation"
      : "bench.reaction.name.laccaseOxidation");
  }
  const reaction = REACTIONS.find((candidate) => candidate.id === id);
  return reaction ? localizeReaction(reaction, locale).name : id;
}

function reactionMechanism(id: string, context: ReactionContext, locale: Locale): string {
  if (
    id === "filler-reinforcement" &&
    context.present.has("iron-powder") &&
    acidIdsForPairs.some((acid) => context.present.has(acid))
  ) {
    return tr(locale, "bench.reaction.mechanism.ironAcid");
  }
  const reaction = REACTIONS.find((candidate) => candidate.id === id);
  return reaction ? localizeReaction(reaction, locale).mechanism : id;
}

const GEL_SET_TIME_DEFAULTS: Record<string, number> = {
  "alginate-calcium": 300,
  "alginate-fe-zn": 300,
  "borax-pva": 300,
  "catechol-iron": 300,
  "chitosan-solubility": 300,
  transglutaminase: 1800,
  "phenol-oxidase": 1800,
  "hrp-crosslinking": 1800,
  "genipin-amine": 1800,
  "glutaraldehyde-amine": 1800,
  "catechol-oxidation": 1800,
  cyanoacrylate: 1800,
  "pu-moisture-cure": 1800,
  "latex-cure": 1800,
};

function eventSetSeconds(
  evaluated: EvaluatedReaction,
  context: ReactionContext,
): number {
  const { reaction, activity } = evaluated;
  if (activity <= 0) return 0;
  if (reaction.id === "silk-beta-sheet") {
    return context.experiment.conditions.forming.startsWith("extrude") ||
      Boolean(context.experiment.conditions.bathId)
      ? 30
      : 300;
  }
  if (reaction.id === "gelatin-thermogel") {
    return context.experiment.conditions.tempC <= 10 ? 600 : 1800;
  }
  if (reaction.setSeconds <= 0) return GEL_SET_TIME_DEFAULTS[reaction.id] ?? 0;
  const scaled = reaction.setSeconds / Math.max(activity, 0.01);
  switch (reaction.id) {
    case "transglutaminase":
      return Math.min(120 * 60, scaled);
    case "phenol-oxidase":
      return Math.min(60 * 60, scaled);
    case "hrp-crosslinking":
      return Math.min(5 * 60, scaled);
    case "catechol-oxidation":
      return Math.min(60 * 60, scaled);
    case "genipin-amine":
      return Math.min(24 * 60 * 60, scaled);
    case "glutaraldehyde-amine":
      return Math.min(30 * 60, scaled);
    case "pu-moisture-cure": {
      const humidity = context.experiment.conditions.atmosphere === "nitrogen"
        ? Math.min(5, context.experiment.conditions.humidityPct)
        : context.experiment.conditions.humidityPct;
      return reaction.setSeconds * clamp(1.5 - humidity / 100, 0.5, 1);
    }
    case "latex-cure":
      return context.present.has("sulfur")
        ? Math.max(reaction.setSeconds, context.experiment.conditions.cureMinutes * 60)
        : reaction.setSeconds;
    default:
      return scaled;
  }
}

function recognizedPairs(
  id: string,
  experiment: Experiment,
  presentParts: Set<string>,
): [string, string][] {
  const pairs: [string, string][] = [];
  const push = (left: string, right: string) => {
    if (left !== right && presentParts.has(left) && presentParts.has(right)) {
      pairs.push([left, right]);
    }
  };
  switch (id) {
    case "alginate-calcium":
      push("alginate", "cacl2");
      push("alginate", "caco3");
      break;
    case "alginate-fe-zn":
      push("alginate", "fecl3");
      push("alginate", "zncl2");
      break;
    case "borax-pva":
      for (const id of presentParts) {
        if (benchById[id]?.category === "polymer" && benchById[id]?.tags.includes("diol")) {
          push("borax", id);
        }
      }
      break;
    case "transglutaminase":
      for (const target of ["gelatin", "casein", "whey-protein", "soy-protein", "collagen", "silk-fibroin", "keratin"]) {
        push("transglutaminase", target);
      }
      for (const target of presentParts) {
        if (
          target.startsWith(CUSTOM_PREFIX) &&
          benchById[target]?.tags.includes("protein")
        ) {
          push("transglutaminase", target);
        }
      }
      break;
    case "phenol-oxidase":
      for (const enzyme of ["tyrosinase", "laccase"]) {
        for (const target of ["silk-fibroin", "mfp5", "gelatin", "dopamine"]) push(enzyme, target);
      }
      break;
    case "hrp-crosslinking":
      for (const target of ["silk-fibroin", "mfp5", "gelatin", "dopamine"]) {
        push("hrp", "hydrogen-peroxide");
        push("hrp", target);
        push("hydrogen-peroxide", target);
      }
      break;
    case "catechol-oxidation":
      for (const catechol of ["dopamine", "mfp5"]) {
        for (const other of presentParts) push(catechol, other);
      }
      break;
    case "catechol-iron":
      push("dopamine", "fecl3");
      push("mfp5", "fecl3");
      break;
    case "genipin-amine":
      for (const target of ["chitosan", "gelatin", "collagen", "casein"]) push("genipin", target);
      break;
    case "glutaraldehyde-amine":
      for (const target of ["chitosan", "gelatin", "collagen", "casein", "mfp5", "dopamine", "keratin"]) {
        push("glutaraldehyde", target);
      }
      break;
    case "chitosan-solubility":
      push("chitosan", "alginate");
      push("chitosan", "water");
      push("chitosan", "acetic-acid");
      push("chitosan", "sodium-citrate");
      break;
    case "gelatin-thermogel":
      push("gelatin", "water");
      break;
    case "silk-beta-sheet":
      for (const silk of ["spider-silk", "silk-fibroin"]) {
        for (const other of presentParts) push(silk, other);
      }
      break;
    case "cyanoacrylate":
      for (const other of presentParts) push("cyanoacrylate", other);
      break;
    case "pu-moisture-cure":
      push("pu", "water");
      break;
    case "latex-cure":
      for (const partner of ["sulfur", "zno", "cacl2", "caco3", ...acidIdsForPairs]) {
        push("latex", partner);
      }
      break;
    case "protease-digestion":
      for (const enzyme of ["trypsin", "papain", "proteinase-k"]) {
        for (const other of presentParts) {
          if (other !== enzyme) push(enzyme, other);
        }
      }
      break;
    case "sodium-water":
      push("sodium-metal", "water");
      break;
    case "bicarbonate-bubbles":
      for (const acid of ["acetic-acid", "formic-acid", "citric-acid"]) {
        push("sodium-bicarbonate", acid);
      }
      break;
    case "filler-reinforcement":
      for (const filler of ["graphene", "cnt", "silica", "cnf", "graphene-oxide", "gold-np", "silver-np"]) {
        for (const other of presentParts) {
          if (["protein", "polymer"].includes(benchById[other]?.category ?? "")) push(filler, other);
        }
      }
      for (const acid of acidIdsForPairs) push("iron-powder", acid);
      break;
  }
  if (id === "latex-cure" && experiment.conditions.forming === "heat-cure") {
    push("latex", "sulfur");
  }
  return pairs;
}

const acidIdsForPairs = ["acetic-acid", "formic-acid", "citric-acid"];

function notModelledInteractions(
  experiment: Experiment,
  evaluated: EvaluatedReaction[],
  locale: Locale,
): { notModelled: string[]; count: number } {
  const presentSet = new Set(
    experiment.parts.filter((part) => part.pct > 0).map((part) => part.id),
  );
  if (experiment.conditions.forming === "extrude-bath" && experiment.conditions.bathId) {
    presentSet.add(experiment.conditions.bathId);
  }
  const presentIds = [...presentSet].filter((id) => Boolean(benchById[id]));
  const present = new Set(presentIds);
  const knownPairs = new Set<string>();
  for (const { reaction } of evaluated) {
    for (const [left, right] of recognizedPairs(reaction.id, experiment, present)) {
      knownPairs.add([left, right].sort().join("|"));
    }
  }
  const reactiveIds = presentIds.filter(
    (id) =>
      id.startsWith(CUSTOM_PREFIX) ||
      benchById[id].tags.some((tag) => tag !== "inert"),
  );
  const unmodelledIds = reactiveIds.filter(
    (id) => ![...knownPairs].some((pair) => pair.split("|").includes(id)),
  );
  const lines: string[] = [];
  const linePairs = new Set<string>();
  const addPairLine = (left: string, right: string) => {
    const key = [left, right].sort().join("|");
    if (left === right || knownPairs.has(key) || linePairs.has(key)) return;
    linePairs.add(key);
    lines.push(tr(locale, "bench.model.notModeled.pair", {
      left: localizeBenchIngredient(benchById[left], locale).name,
      right: localizeBenchIngredient(benchById[right], locale).name,
    }));
  };
  if (unmodelledIds.length > 1) {
    for (let i = 0; i < unmodelledIds.length; i += 1) {
      for (let j = i + 1; j < unmodelledIds.length; j += 1) {
        addPairLine(unmodelledIds[i], unmodelledIds[j]);
      }
    }
  }
  for (const id of unmodelledIds.filter((item) => item.startsWith(CUSTOM_PREFIX))) {
    for (const other of presentIds) addPairLine(id, other);
  }
  if (unmodelledIds.length === 1 && lines.length === 0) {
    const [id] = unmodelledIds;
    lines.push(tr(locale, "bench.model.notModeled.single", {
      ingredient: localizeBenchIngredient(benchById[id], locale).name,
    }));
  }
  return { notModelled: lines, count: unmodelledIds.length };
}

function highestHazard(
  experiment: Experiment,
  field: "toxicity" | "skin",
  threshold = 0.5,
): 0 | 1 | 2 | 3 {
  return experiment.parts.reduce((highest, part) => {
    const ingredient = benchById[part.id];
    if (!ingredient || part.pct < threshold) return highest;
    return Math.max(highest, ingredient[field]) as 0 | 1 | 2 | 3;
  }, 0 as 0 | 1 | 2 | 3);
}

function waterBehavior(
  experiment: Experiment,
  evaluated: EvaluatedReaction[],
  locale: Locale,
): { water: RunResult["water"]; dissolveTime: string } {
  const active = new Set(evaluated.filter((event) => event.activity > 0).map((event) => event.reaction.id));
  if (active.has("alginate-calcium") || active.has("alginate-fe-zn")) {
    return { water: "swells", dissolveTime: tr(locale, "bench.model.water.ionExchange") };
  }
  if (
    active.has("transglutaminase") ||
    active.has("phenol-oxidase") ||
    active.has("hrp-crosslinking") ||
    active.has("genipin-amine") ||
    active.has("glutaraldehyde-amine") ||
    (active.has("latex-cure") && experiment.parts.some((part) => part.id === "sulfur"))
  ) {
    return { water: "resists", dissolveTime: tr(locale, "bench.model.water.noDissolve") };
  }
  if (active.has("borax-pva") || experiment.parts.some((part) => part.id === "gelatin")) {
    return { water: "dissolves", dissolveTime: tr(locale, "bench.model.water.hoursOrLess") };
  }
  const structural = experiment.parts
    .map((part) => benchById[part.id])
    .filter((ingredient) => ingredient && ["protein", "polymer"].includes(ingredient.category));
  if (structural.some((ingredient) => ingredient.water === "dissolves")) {
    return { water: "dissolves", dissolveTime: tr(locale, "bench.model.water.minutesToHours") };
  }
  if (structural.some((ingredient) => ingredient.water === "swells")) {
    return { water: "swells", dissolveTime: tr(locale, "bench.model.water.swells") };
  }
  return { water: "resists", dissolveTime: tr(locale, "bench.model.water.noDissolve") };
}

function resultProduct(
  experiment: Experiment,
  context: ReactionContext,
  evaluated: EvaluatedReaction[],
  setSeconds: number,
  evaporationFast: boolean,
  missingSolvent: boolean,
): Product {
  const active = new Set(evaluated.filter((event) => event.activity > 0).map((event) => event.reaction.id));
  if (active.has("sodium-water")) return "dangerous";
  if (active.has("cyanoacrylate") && (context.waterPct > 0 || context.present.has("acetic-acid") || context.present.has("formic-acid"))) {
    return "clumps";
  }
  const alginateIndex = experiment.parts.findIndex((part) => part.id === "alginate");
  const calciumIndex = experiment.parts.findIndex((part) => ["cacl2", "caco3"].includes(part.id));
  if (alginateIndex >= 0 && calciumIndex >= 0 && calciumIndex < alginateIndex) {
    return "clumps";
  }
  if (missingSolvent) return "clumps";
  if (experiment.conditions.forming === "cast-film") return "film";
  if (experiment.conditions.forming === "heat-cure") return "solid";
  if (experiment.conditions.forming === "extrude-bath") {
    const bath = experiment.conditions.bathId;
    const alginateBath = bath === "cacl2" && active.has("alginate-calcium");
    const silkBath = ["ethanol", "methanol"].includes(bath ?? "") && active.has("silk-beta-sheet");
    const chitosanBath = bath === "sodium-citrate" && active.has("chitosan-solubility");
    if (alginateBath || silkBath || chitosanBath) return "fiber";
    return "solution";
  }
  if (experiment.conditions.forming === "extrude-air") {
    if (active.has("cyanoacrylate") && context.waterPct === 0) return "adhesive";
    if ((setSeconds > 0 && setSeconds <= 2) || evaporationFast) return "fiber";
    if (active.has("borax-pva")) return "slime";
    return "solution";
  }
  if (active.has("cyanoacrylate")) return "adhesive";
  if (active.has("borax-pva")) return "slime";
  if (
    active.has("catechol-oxidation") ||
    active.has("catechol-iron") ||
    (active.has("phenol-oxidase") && context.present.has("dopamine"))
  ) {
    return "adhesive";
  }
  if (active.has("gelatin-thermogel") || active.has("chitosan-solubility")) return "gel";
  if (active.has("transglutaminase") || active.has("phenol-oxidase") || active.has("genipin-amine") || active.has("glutaraldehyde-amine")) {
    return "gel";
  }
  if (active.has("bicarbonate-bubbles")) return "solution";
  const hasStructure = experiment.parts.some((part) =>
    ["protein", "polymer"].includes(benchById[part.id]?.category ?? ""),
  );
  if (!hasStructure) return "nothing";
  return "solution";
}

export function simulate(experiment: Experiment, locale: Locale = DEFAULT_LOCALE): RunResult {
  const inputParts = experiment.parts.filter(
    (part) => benchById[part.id] && Number.isFinite(part.pct) && part.pct > 0,
  );
  const partsExperiment: Experiment = {
    ...experiment,
    parts: inputParts,
    conditions: { ...experiment.conditions },
  };
  const ph = effectivePH(partsExperiment);
  const missingSolventParts = inputParts.filter((part) => {
    const ingredient = benchById[part.id];
    return (
      ["protein", "polymer"].includes(ingredient.category) &&
      requiresSolutionSolvent(part.id, partsExperiment.conditions.forming) &&
      matchingSolventPct(partsExperiment, part.id, ph) < 30
    );
  });
  const missingSolvent = missingSolventParts.length > 0;
  const present = new Set(inputParts.map((part) => part.id));
  if (experiment.conditions.forming === "extrude-bath" && experiment.conditions.bathId) {
    present.add(experiment.conditions.bathId);
  }
  const waterPct = inputParts.reduce((total, part) => {
    if (part.id === "water" || part.id === "acetic-acid") return total + part.pct;
    return total;
  }, 0);
  const context: ReactionContext = {
    experiment: partsExperiment,
    present,
    effectivePH: ph,
    waterPct,
    amount: (id) => partAmount(partsExperiment, id),
    ingredient: (id) => benchById[id],
  };

  const evaluated: EvaluatedReaction[] = REACTIONS
    .filter((reaction) => reaction.needs(partsExperiment, present))
    .map((reaction) => {
      const fit = reaction.fit(context);
      const activity = clamp(fit.activity, 0, 1);
      return {
        reaction,
        activity,
        status: statusForActivity(activity),
        reasons: [
          ...fit.reasons,
          ...(activity > 0 && reaction.effects.note ? [reaction.effects.note] : []),
        ],
        setSeconds: 0,
      };
    });
  const proteaseEvent = evaluated.find((event) => event.reaction.id === "protease-digestion");
  if (proteaseEvent && proteaseEvent.activity > 0) {
    for (const event of evaluated) {
      if (["transglutaminase", "phenol-oxidase", "hrp-crosslinking"].includes(event.reaction.id)) {
        event.activity *= 1 - proteaseEvent.activity;
        event.status = statusForActivity(event.activity);
        if (event.activity < 0.8) {
          event.reasons.push(tr(locale, "bench.model.reason.proteaseSuppression"));
        }
      }
    }
  }
  for (const event of evaluated) {
    event.setSeconds = eventSetSeconds(event, context);
  }

  const conditions = partsExperiment.conditions;
  const solventParts = inputParts
    .map((part) => ({ part, ingredient: benchById[part.id] }))
    .filter((item) => item.ingredient?.boilC !== undefined);
  const waterPresent = inputParts.some((part) => part.id === "water" && part.pct > 0);
  const waterBp = waterBoilingPointC(conditions.pressureKPa);
  const waterBoiling = waterPresent && conditions.tempC >= waterBp;
  const solventBoiling = solventParts.some(({ part, ingredient }) =>
    ingredient?.id !== "water" &&
    ingredient?.boilC !== undefined &&
    conditions.tempC >= solventBoilingPointC(ingredient.boilC, conditions.pressureKPa) &&
    part.pct > 0,
  );
  const boiling = waterBoiling || solventBoiling;
  const degassed =
    conditions.atmosphere === "vacuum" &&
    conditions.mixMinutes <= 10 &&
    !boiling;
  const evaporationFast = solventBoiling && !waterBoiling;

  const warnings: Warning[] = [];
  if (!inputParts.some((part) => ["protein", "polymer"].includes(benchById[part.id]?.category ?? ""))) {
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.noStructure") });
  }
  if (missingSolvent) {
    warnings.push({
      level: "warn",
      text: tr(locale, "bench.model.warning.dryPowder"),
    });
  }
  const solidsPct = inputParts.reduce((total, part) => {
    return total + (benchById[part.id].category === "solvent" ? 0 : part.pct);
  }, 0);
  if (solidsPct < 5 && inputParts.length > 0) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.lowSolids") });
  }
  if (waterBoiling && (conditions.atmosphere === "vacuum" || conditions.pressureKPa < 20)) {
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.waterBoils") });
  } else if (boiling) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.solventBoils") });
  }
  if (degassed) {
    warnings.push({ level: "good", text: tr(locale, "bench.model.warning.degassed") });
  }
  if (inputParts.some((part) => ["protein", "enzyme"].includes(benchById[part.id].category)) && conditions.mixRpm > 2000) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.highShear") });
  }
  if (conditions.mixMinutes < 1 && inputParts.length > 3) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.incompleteMix") });
  }
  if (conditions.tempC > 200 || (conditions.tempC > 80 && inputParts.some((part) => benchById[part.id].category === "protein"))) {
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.highHeat") });
  }
  if (inputParts.some((part) => part.id === "chitosan") && ph > 6.5) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.chitosanPH") });
  }
  if (
    conditions.forming === "beaker" &&
    inputParts.some((part) => part.id === "chitosan") &&
    inputParts.some((part) => part.id === "alginate") &&
    ph <= 6.5
  ) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.chitosanAlginate") });
  }
  const alginateIndex = inputParts.findIndex((part) => part.id === "alginate");
  const calciumIndex = inputParts.findIndex((part) => ["cacl2", "caco3"].includes(part.id));
  const calciumInMix = calciumIndex >= 0 && alginateIndex >= 0;
  if (
    calciumInMix &&
    (conditions.forming === "beaker" || calciumIndex < alginateIndex)
  ) {
    warnings.push({
      level: "warn",
      text: tr(locale, "bench.model.warning.contactGel"),
    });
  }
  if (inputParts.some((part) => part.id === "sulfur") && inputParts.some((part) => part.id === "latex") && conditions.tempC < (present.has("zno") ? 120 : 140)) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.latexCold") });
  }
  if (
    evaluated.some((event) => event.reaction.id === "alginate-fe-zn" && event.activity > 0) &&
    present.has("fecl3")
  ) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.ironColor") });
  }
  if (inputParts.some((part) => part.id === "iron-powder") && acidIdsForPairs.some((id) => present.has(id))) {
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.ironAcid") });
  }
  if (evaluated.some((event) => event.reaction.id === "bicarbonate-bubbles" && event.activity > 0) && !degassed) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.bubbles") });
  }
  if (evaluated.some((event) => event.reaction.id === "silk-beta-sheet" && event.activity === 0)) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.silk") });
  }
  if (evaluated.some((event) => event.reaction.id === "cyanoacrylate" && event.activity > 0 && waterPct > 0)) {
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.cyanoacrylate") });
  }
  if (evaluated.some((event) => event.reaction.id === "sodium-water" && event.activity > 0)) {
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.sodium") });
  }

  let tensileBase = 0;
  let elongationBase = 0;
  let structuralWeight = 0;
  const contributingParts = inputParts.filter((part) => {
    const ingredient = benchById[part.id];
    return (
      ["protein", "polymer"].includes(ingredient.category) &&
      ingredient.tensileMPa !== undefined &&
      (!requiresSolutionSolvent(part.id, conditions.forming) ||
        matchingSolventPct(partsExperiment, part.id, ph) >= 30)
    );
  });
  const contributingIds = new Set(contributingParts.map((part) => part.id));
  const proteaseStrengthFactor = proteaseEvent?.activity
    ? 1 - 0.85 * proteaseEvent.activity
    : 1;
  for (const part of inputParts) {
    const ingredient = benchById[part.id];
    if (!contributingIds.has(part.id)) continue;
    const baseTensile = ingredient.tensileMPa ?? 0;
    let componentFactor = 1;
    if (ingredient.id === "chitosan" && ph > 6.5) componentFactor *= 0.2;
    if (ingredient.category === "protein" && conditions.tempC > 80) componentFactor *= 0.3;
    if (ingredient.category === "protein") componentFactor *= proteaseStrengthFactor;
    tensileBase += part.pct * baseTensile * componentFactor;
    elongationBase += part.pct * (ingredient.elongationPct ?? 0) * componentFactor;
    structuralWeight += part.pct;
  }
  if (structuralWeight > 0) {
    tensileBase /= structuralWeight;
    elongationBase /= structuralWeight;
  }
  const solidsFraction = clamp(solidsPct / 100, 0, 1);
  const consumedSolids = new Map<string, number>();
  const consumedByRule: Record<string, string[]> = {
    "alginate-calcium": ["cacl2", "caco3"],
    "alginate-fe-zn": ["fecl3", "zncl2"],
    "borax-pva": ["borax"],
    "catechol-iron": ["fecl3"],
    "chitosan-solubility": ["sodium-citrate"],
    "silk-beta-sheet": ["kcl"],
    "latex-cure": ["sulfur", "zno", "cacl2", "caco3"],
    "bicarbonate-bubbles": ["sodium-bicarbonate"],
  };
  for (const event of evaluated) {
    if (event.activity <= 0) continue;
    for (const id of consumedByRule[event.reaction.id] ?? []) {
      consumedSolids.set(id, Math.max(consumedSolids.get(id) ?? 0, event.activity));
    }
  }
  const networkFormerMass = contributingParts.reduce((total, part) => total + part.pct, 0);
  const nonNetworkSolids = inputParts.reduce((total, part) => {
    const ingredient = benchById[part.id];
    if (ingredient.category === "solvent" || contributingIds.has(part.id)) return total;
    return total + part.pct * (1 - (consumedSolids.get(part.id) ?? 0));
  }, 0);
  const networkMassFraction = clamp(
    networkFormerMass / Math.max(networkFormerMass + nonNetworkSolids, 0.01),
    0.05,
    1,
  );
  const networkSum = evaluated.reduce((total, event) => {
    const network = event.reaction.networkFor?.(context) ?? event.reaction.network;
    return total + network * event.activity;
  }, 0);
  let tensile = tensileBase * solidsFraction * networkMassFraction * (1 + networkSum);
  const hasElastomer = inputParts.some((part) => benchById[part.id].tags.includes("elastomer"));
  const boraxActive = evaluated.some((event) => event.reaction.id === "borax-pva" && event.activity > 0);
  let elongation = elongationBase * solidsFraction;
  if (!hasElastomer && !boraxActive) elongation *= Math.max(0, 1 - 0.4 * networkSum);
  let tack = inputParts.reduce((total, part) => total + part.pct * benchById[part.id].tack, 0) / 100;

  for (const event of evaluated) {
    const { reaction, activity } = event;
    if (activity > 0) {
      const effects = reaction.effects;
      if (effects.tensileMultiplier !== undefined) {
        const bubbleDegassed = reaction.id === "bicarbonate-bubbles" && degassed;
        if (!bubbleDegassed) {
          tensile *= 1 + (effects.tensileMultiplier - 1) * activity;
        }
      }
      if (effects.elongationMultiplier !== undefined) {
        elongation *= 1 + (effects.elongationMultiplier - 1) * activity;
      }
      if (effects.tackDelta !== undefined) tack += effects.tackDelta * activity;
      if (
        reaction.id === "latex-cure" &&
        present.has("sulfur") &&
        conditions.tempC >= (present.has("zno") ? 120 : 140) &&
        conditions.cureMinutes >= 10
      ) {
        tensile *= 1 + (2.5 - 1) * activity;
      }
    } else if (reaction.id === "silk-beta-sheet") {
      tensile *= 0.3;
    }
  }
  const solidsDenominator = Math.max(solidsPct, 1);
  const plasticizerFraction = inputParts
    .filter((part) => ["glycerol", "sorbitol"].includes(part.id))
    .reduce((total, part) => total + part.pct, 0) / solidsDenominator;
  if (plasticizerFraction > 0) {
    tensile *= Math.max(0.15, 1 - 1.8 * plasticizerFraction);
    elongation *= 1 + 4 * plasticizerFraction;
  }

  const fillerLimits: Record<string, number> = {
    graphene: 0.03,
    cnt: 0.03,
    "graphene-oxide": 0.03,
    silica: 0.1,
    cnf: 0.1,
    "gold-np": 0.02,
    "silver-np": 0.02,
  };
  const fillerParts = inputParts.filter((part) => part.id in fillerLimits);
  for (const part of fillerParts) {
    const ingredient = benchById[part.id];
    const share = part.pct / solidsDenominator;
    const limit = fillerLimits[part.id];
    const effective = Math.min(share, limit);
    const reinforcementMPa = ingredient.tensileMPa ?? tensile;
    tensile *= 1 + effective * (reinforcementMPa / Math.max(tensile, 1)) * 0.15;
    if (share > limit) {
      tensile *= Math.max(0.5, 1 - (share - limit) * 3);
      elongation *= 0.6;
      warnings.push({
        level: "warn",
        text: tr(locale, "bench.model.warning.filler", {
          ingredient: localizeBenchIngredient(ingredient, locale).name,
          limit: limit * 100,
        }),
      });
    } else {
      elongation *= 1 - share * 2;
    }
  }
  if (conditions.mixRpm > 2000 && inputParts.some((part) => benchById[part.id].category === "protein")) {
    tensile *= 0.85;
  }
  if (conditions.mixMinutes < 1 && inputParts.length > 3) tensile *= 0.85;
  if (degassed) tensile *= 1.1;
  tensile = Math.max(0, Math.min(1500, tensile));
  elongation = Math.max(0, elongation);

  const activeEventIds = new Set(evaluated.filter((event) => event.activity > 0).map((event) => event.reaction.id));
  let setSeconds = evaluated.reduce((maximum, event) => Math.max(maximum, event.setSeconds), 0);
  if (setSeconds === 0 && conditions.forming === "heat-cure") {
    setSeconds = Math.max(1, conditions.cureMinutes * 60);
  } else if (setSeconds === 0 && (conditions.forming === "extrude-air" || conditions.forming === "cast-film")) {
    const hasWaterSolvent = inputParts.some((part) => part.id === "water");
    const hasVolatileSolvent = solventParts.length > 0;
    if (hasVolatileSolvent) {
      setSeconds = conditions.forming === "extrude-air"
        ? (hasWaterSolvent ? 60 : 20)
        : (hasWaterSolvent ? 2 * 60 * 60 : 20 * 60);
    }
  }
  const product = resultProduct(
    partsExperiment,
    context,
    evaluated,
    setSeconds,
    evaporationFast,
    missingSolvent,
  );
  if (
    !["solution", "nothing", "clumps", "dangerous"].includes(product) &&
    (!Number.isFinite(setSeconds) || setSeconds <= 0)
  ) {
    setSeconds = conditions.forming === "heat-cure"
      ? Math.max(1, conditions.cureMinutes * 60)
      : 300;
  }
  const latexVulcanized =
    product === "solid" &&
    evaluated.some((event) => event.reaction.id === "latex-cure" && event.activity >= 0.5) &&
    present.has("latex") &&
    present.has("sulfur");
  if (!["solution", "nothing", "clumps", "dangerous"].includes(product)) {
    if (latexVulcanized) {
      tensile = Math.min(tensile, 30);
    } else if (networkFormerMass > 0) {
      const strongestFormer = Math.max(
        ...contributingParts.map((part) => benchById[part.id].tensileMPa ?? 0),
      );
      tensile = Math.min(tensile, strongestFormer * 1.25, 1500);
    }
    if (product === "gel" || product === "slime") {
      const covalentIds = new Set([
        "transglutaminase",
        "phenol-oxidase",
        "hrp-crosslinking",
        "genipin-amine",
        "glutaraldehyde-amine",
        "latex-cure",
      ]);
      const covalentNetwork = evaluated.some(
        (event) => covalentIds.has(event.reaction.id) && event.activity >= 0.5,
      );
      tensile = Math.min(tensile, covalentNetwork ? 5 : 1);
    }
  } else {
    tensile = Math.min(tensile, 0.5);
    if (proteaseEvent?.activity) tensile *= proteaseStrengthFactor;
    elongation = 0;
  }
  if (product === "dangerous") {
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.dangerous") });
  }
  if (tensile <= 0 && inputParts.length > 0) {
    warnings.push({ level: "warn", text: tr(locale, "bench.model.warning.noNetwork") });
  }

  const { notModelled, count } = notModelledInteractions(partsExperiment, evaluated, locale);
  const confidence = clamp(1 - 0.15 * count, 0.2, 1);
  const networkFormerHazard = inputParts.reduce((highest, part) => {
    const ingredient = benchById[part.id];
    return ["protein", "polymer"].includes(ingredient.category)
      ? Math.max(highest, ingredient.toxicity)
      : highest;
  }, 0);
  const consumedIds = new Set<string>();
  if (activeEventIds.has("transglutaminase")) consumedIds.add("transglutaminase");
  if (activeEventIds.has("phenol-oxidase")) {
    consumedIds.add("tyrosinase");
    consumedIds.add("laccase");
  }
  if (activeEventIds.has("hrp-crosslinking")) {
    consumedIds.add("hrp");
    consumedIds.add("hydrogen-peroxide");
  }
  if (activeEventIds.has("genipin-amine")) consumedIds.add("genipin");
  if (activeEventIds.has("glutaraldehyde-amine")) consumedIds.add("glutaraldehyde");
  if (activeEventIds.has("cyanoacrylate")) consumedIds.add("cyanoacrylate");
  if (activeEventIds.has("pu-moisture-cure")) consumedIds.add("pu");
  if (activeEventIds.has("borax-pva")) consumedIds.add("borax");
  let curedToxicity = inputParts.reduce((highest, part) => {
    const ingredient = benchById[part.id];
    if (part.pct < 0.5) return highest;
    const toxicity = Math.max(
      0,
      ingredient.toxicity - (consumedIds.has(part.id) ? 1 : 0),
    );
    return Math.max(highest, toxicity);
  }, 0);
  curedToxicity = Math.max(curedToxicity, networkFormerHazard) as RunResult["curedToxicity"];
  let wetToxicity = highestHazard(partsExperiment, "toxicity");
  let skin = highestHazard(partsExperiment, "skin");
  for (const event of evaluated) {
    if (event.activity <= 0) continue;
    if (event.reaction.effects.wetToxicity !== undefined) {
      wetToxicity = Math.max(wetToxicity, event.reaction.effects.wetToxicity) as RunResult["wetToxicity"];
    }
    if (event.reaction.effects.skin !== undefined) {
      skin = Math.max(skin, event.reaction.effects.skin) as RunResult["skin"];
    }
  }
  if (activeEventIds.has("sodium-water")) {
    wetToxicity = 3;
    curedToxicity = 3;
    skin = 3;
  }
  let edible =
    inputParts.length > 0 &&
    inputParts.every((part) => benchById[part.id].edible) &&
    !activeEventIds.has("glutaraldehyde-amine") &&
    !activeEventIds.has("sodium-water");
  if (ph <= 2 || ph >= 12.5) {
    wetToxicity = Math.max(wetToxicity, 2) as RunResult["wetToxicity"];
    skin = 3;
    edible = false;
    warnings.push({ level: "bad", text: tr(locale, "bench.model.warning.corrosive", { ph: ph.toFixed(1) }) });
  } else if (ph <= 3 || ph >= 11) {
    skin = Math.max(skin, 2) as RunResult["skin"];
  }
  const baseWater = waterBehavior(partsExperiment, evaluated, locale);
  const biodegradable =
    inputParts.length > 0 &&
    inputParts.every((part) => benchById[part.id].biodegradable);
  const costPerKg = inputParts.reduce(
    (total, part) => total + (part.pct / 100) * benchById[part.id].costPerKg,
    0,
  );
  const eventResults: ReactionEvent[] = evaluated.map((event) => ({
    id: event.reaction.id,
    name: reactionName(event.reaction.id, context, locale),
    status: event.status,
    activity: roundTo(event.activity, 3),
    mechanism: reactionMechanism(event.reaction.id, context, locale),
    reasons: [...new Set(event.reasons)],
  }));
  const localizedEvents = eventResults.map((event) => localizeReactionEvent(event, locale));
  const summaryKeys: Record<Product, MessageKey> = {
    nothing: "bench.model.summary.nothing",
    solution: "bench.model.summary.solution",
    gel: "bench.model.summary.gel",
    slime: "bench.model.summary.slime",
    fiber: "bench.model.summary.fiber",
    film: "bench.model.summary.film",
    adhesive: "bench.model.summary.adhesive",
    solid: "bench.model.summary.solid",
    clumps: "bench.model.summary.clumps",
    dangerous: "bench.model.summary.dangerous",
  };
  const summary = tr(locale, summaryKeys[product]);
  const warningsDeduplicated = warnings.filter(
    (warning, index) => warnings.findIndex((item) => item.text === warning.text) === index,
  );

  return {
    product,
    productLabel: productLabel(product, locale),
    summary,
    tensileMPa: roundTo(tensile, 2),
    elongationPct: roundTo(elongation, 2),
    tack: roundTo(clamp(tack, 0, 10), 2),
    toughnessMJm3: roundTo((tensile * elongation * 0.5) / 100, 2),
    setSeconds: roundTo(setSeconds, 1),
    wetToxicity: wetToxicity as RunResult["wetToxicity"],
    curedToxicity: curedToxicity as RunResult["curedToxicity"],
    skin,
    edible,
    water: baseWater.water,
    dissolveTime: baseWater.dissolveTime,
    biodegradable,
    costPerKg: roundTo(costPerKg, 2),
    effectivePH: roundTo(activeEventIds.has("sodium-water") ? 14 : ph, 2),
    events: localizedEvents,
    warnings: warningsDeduplicated,
    notModelled: notModelled,
    confidence: roundTo(confidence, 2),
  };
}

export { effectivePH, solventBoilingPointC, waterBoilingPointC };
