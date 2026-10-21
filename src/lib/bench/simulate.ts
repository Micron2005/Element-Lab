import { effectivePH, solventBoilingPointC, waterBoilingPointC } from "./conditions";
import { benchById } from "./library";
import {
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

function productLabel(product: Product): string {
  const labels: Record<Product, string> = {
    nothing: "No useful solid",
    solution: "Solution or weak mixture",
    gel: "Crosslinked gel",
    slime: "Reversible slime",
    fiber: "Fiber",
    film: "Film",
    adhesive: "Adhesive",
    solid: "Cured solid",
    clumps: "Clumps",
    dangerous: "Dangerous reaction",
  };
  return labels[product];
}

function reactionName(
  id: string,
  context: ReactionContext,
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
    if (matrix) return "Filler reinforcement and iron-acid gas release";
    return "Iron and acid gas release";
  }
  if (id === "alginate-fe-zn") {
    if (context.present.has("fecl3")) return "Alginate–iron(III)";
    return "Alginate–zinc";
  }
  if (id === "phenol-oxidase") {
    return context.present.has("tyrosinase")
      ? "Tyrosinase/laccase protein oxidation"
      : "Laccase protein oxidation";
  }
  return REACTIONS.find((reaction) => reaction.id === id)?.name ?? id;
}

function reactionMechanism(id: string, context: ReactionContext): string {
  if (
    id === "filler-reinforcement" &&
    context.present.has("iron-powder") &&
    acidIdsForPairs.some((acid) => context.present.has(acid))
  ) {
    return "Iron reacts with acid to form iron(II) ions and hydrogen gas.";
  }
  return REACTIONS.find((reaction) => reaction.id === id)?.mechanism ?? id;
}

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
  if (reaction.setSeconds <= 0) return 0;
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
  const reactiveIds = presentIds.filter((id) =>
    benchById[id].tags.some((tag) => tag !== "inert"),
  );
  const unmodelledIds = reactiveIds.filter(
    (id) => ![...knownPairs].some((pair) => pair.split("|").includes(id)),
  );
  const lines: string[] = [];
  if (unmodelledIds.length > 1) {
    for (let i = 0; i < unmodelledIds.length; i += 1) {
      for (let j = i + 1; j < unmodelledIds.length; j += 1) {
        const left = unmodelledIds[i];
        const right = unmodelledIds[j];
        if (!knownPairs.has([left, right].sort().join("|"))) {
          lines.push(`${benchById[left].name} + ${benchById[right].name}: not in the model`);
        }
      }
    }
  } else if (unmodelledIds.length === 1) {
    const [id] = unmodelledIds;
    lines.push(`${benchById[id].name}: no modeled interaction with another present ingredient`);
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
): { water: RunResult["water"]; dissolveTime: string } {
  const active = new Set(evaluated.filter((event) => event.activity > 0).map((event) => event.reaction.id));
  if (active.has("alginate-calcium") || active.has("alginate-fe-zn")) {
    return { water: "swells", dissolveTime: "Hours; salty water or sweat can exchange the ions." };
  }
  if (
    active.has("transglutaminase") ||
    active.has("phenol-oxidase") ||
    active.has("hrp-crosslinking") ||
    active.has("genipin-amine") ||
    active.has("glutaraldehyde-amine") ||
    (active.has("latex-cure") && experiment.parts.some((part) => part.id === "sulfur"))
  ) {
    return { water: "resists", dissolveTime: "No dissolving expected in ordinary water." };
  }
  if (active.has("borax-pva") || experiment.parts.some((part) => part.id === "gelatin")) {
    return { water: "dissolves", dissolveTime: "Hours or less, depending on thickness and temperature." };
  }
  const structural = experiment.parts
    .map((part) => benchById[part.id])
    .filter((ingredient) => ingredient && ["protein", "polymer"].includes(ingredient.category));
  if (structural.some((ingredient) => ingredient.water === "dissolves")) {
    return { water: "dissolves", dissolveTime: "Minutes to hours, depending on thickness." };
  }
  if (structural.some((ingredient) => ingredient.water === "swells")) {
    return { water: "swells", dissolveTime: "Hours; material may swell without dissolving." };
  }
  return { water: "resists", dissolveTime: "No dissolving expected in ordinary water." };
}

function resultProduct(
  experiment: Experiment,
  context: ReactionContext,
  evaluated: EvaluatedReaction[],
  warnings: Warning[],
  setSeconds: number,
  evaporationFast: boolean,
  missingSolvent: boolean,
): Product {
  const active = new Set(evaluated.filter((event) => event.activity > 0).map((event) => event.reaction.id));
  if (active.has("sodium-water")) return "dangerous";
  if (active.has("cyanoacrylate") && (context.waterPct > 0 || context.present.has("acetic-acid") || context.present.has("formic-acid"))) {
    return "clumps";
  }
  if (
    warnings.some((warning) => warning.text.includes("gels on contact into lumps")) &&
    experiment.conditions.forming === "beaker"
  ) {
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
    if (setSeconds <= 2 || evaporationFast) return "fiber";
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
  const hasStructure = experiment.parts.some((part) =>
    ["protein", "polymer"].includes(benchById[part.id]?.category ?? ""),
  );
  if (!hasStructure) return "nothing";
  return "solution";
}

export function simulate(experiment: Experiment): RunResult {
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
        if (event.activity < 0.8) event.reasons.push("protease reduces the other enzyme's activity");
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
    warnings.push({ level: "bad", text: "No structural polymer or protein is present." });
  }
  if (missingSolvent) {
    warnings.push({
      level: "warn",
      text: "Dry powder: nothing here dissolves it, so it can't be spun or cast.",
    });
  }
  const solidsPct = inputParts.reduce((total, part) => {
    return total + (benchById[part.id].category === "solvent" ? 0 : part.pct);
  }, 0);
  if (solidsPct < 5 && inputParts.length > 0) {
    warnings.push({ level: "warn", text: "Solids below 5%: the mixture is likely to be weak." });
  }
  if (waterBoiling && (conditions.atmosphere === "vacuum" || conditions.pressureKPa < 20)) {
    warnings.push({ level: "bad", text: "Water boils off violently at this pressure." });
  } else if (boiling) {
    warnings.push({ level: "warn", text: "A solvent reaches its boiling point and may evaporate or form bubbles." });
  }
  if (degassed) {
    warnings.push({ level: "good", text: "Short vacuum mixing degasses the mixture; fewer bubbles are expected." });
  }
  if (inputParts.some((part) => ["protein", "enzyme"].includes(benchById[part.id].category)) && conditions.mixRpm > 2000) {
    warnings.push({ level: "warn", text: "High-shear mixing can foam protein mixtures." });
  }
  if (conditions.mixMinutes < 1 && inputParts.length > 3) {
    warnings.push({ level: "warn", text: "Not fully mixed: less than one minute for more than three ingredients." });
  }
  if (conditions.tempC > 200 || (conditions.tempC > 80 && inputParts.some((part) => benchById[part.id].category === "protein"))) {
    warnings.push({ level: "bad", text: "High heat denatures or chars proteins." });
  }
  if (inputParts.some((part) => part.id === "chitosan") && ph > 6.5) {
    warnings.push({ level: "warn", text: "Chitosan does not dissolve above pH 6.5; add acetic acid to dissolve it." });
  }
  if (
    conditions.forming === "beaker" &&
    inputParts.some((part) => part.id === "chitosan") &&
    inputParts.some((part) => part.id === "alginate") &&
    ph <= 6.5
  ) {
    warnings.push({ level: "warn", text: "Chitosan and alginate can clump in a beaker; extrude for an interfacial film or fiber." });
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
      text: "Gels on contact into lumps (fish-eyes); extrude alginate into a calcium bath instead.",
    });
  }
  if (inputParts.some((part) => part.id === "sulfur") && inputParts.some((part) => part.id === "latex") && conditions.tempC < (present.has("zno") ? 120 : 140)) {
    warnings.push({ level: "warn", text: "Nothing happens until heated: sulfur does not vulcanize latex at room temperature." });
  }
  if (
    evaluated.some((event) => event.reaction.id === "alginate-fe-zn" && event.activity > 0) &&
    present.has("fecl3")
  ) {
    warnings.push({ level: "warn", text: "Iron(III) makes the alginate mixture brown." });
  }
  if (inputParts.some((part) => part.id === "iron-powder") && acidIdsForPairs.some((id) => present.has(id))) {
    warnings.push({ level: "bad", text: "Iron powder with acid can release hydrogen gas." });
  }
  if (evaluated.some((event) => event.reaction.id === "bicarbonate-bubbles" && event.activity > 0) && !degassed) {
    warnings.push({ level: "warn", text: "Acid and bicarbonate release CO₂ bubbles; voids can weaken the material." });
  }
  if (evaluated.some((event) => event.reaction.id === "silk-beta-sheet" && event.activity === 0)) {
    warnings.push({ level: "warn", text: "Silk has no β-sheet trigger and remains a weak solution or gel." });
  }
  if (evaluated.some((event) => event.reaction.id === "cyanoacrylate" && event.activity > 0 && waterPct > 0)) {
    warnings.push({ level: "bad", text: "Cyanoacrylate cures inside the mix or cartridge when water is present." });
  }
  if (evaluated.some((event) => event.reaction.id === "sodium-water" && event.activity > 0)) {
    warnings.push({ level: "bad", text: "DANGEROUS — sodium reacts violently with water; hydrogen fire risk. Do not attempt." });
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
        text: `${ingredient.name} exceeds its ${limit * 100}% modeled loading limit; agglomeration makes it brittle.`,
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
    setSeconds = Math.max(0, conditions.cureMinutes * 60);
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
    warnings,
    setSeconds,
    evaporationFast,
    missingSolvent,
  );
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
    warnings.push({ level: "bad", text: "DANGEROUS — do not attempt this mixture." });
  }
  if (tensile <= 0 && inputParts.length > 0) {
    warnings.push({ level: "warn", text: "No modeled network is carrying tensile load." });
  }

  const { notModelled, count } = notModelledInteractions(partsExperiment, evaluated);
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
    warnings.push({ level: "bad", text: `Corrosive at pH ${ph.toFixed(1)}.` });
  } else if (ph <= 3 || ph >= 11) {
    skin = Math.max(skin, 2) as RunResult["skin"];
  }
  const baseWater = waterBehavior(partsExperiment, evaluated);
  const biodegradable =
    inputParts.length > 0 &&
    inputParts.every((part) => benchById[part.id].biodegradable);
  const costPerKg = inputParts.reduce(
    (total, part) => total + (part.pct / 100) * benchById[part.id].costPerKg,
    0,
  );
  const eventResults: ReactionEvent[] = evaluated.map((event) => ({
    id: event.reaction.id,
    name: reactionName(event.reaction.id, context),
    status: event.status,
    activity: roundTo(event.activity, 3),
    mechanism: reactionMechanism(event.reaction.id, context),
    reasons: [...new Set(event.reasons)],
  }));
  const summaryByProduct: Record<Product, string> = {
    nothing: "No modeled structural material or useful reaction is present.",
    solution: "The mixture remains mostly a solution or weak, uncured material.",
    gel: "The modeled interactions form a connected gel network.",
    slime: "Reversible borate links make a stretchy PVA slime.",
    fiber: "The process forms a continuous fiber in the selected forming conditions.",
    film: "The mixture can be cast as a film; drying and defects are simplified.",
    adhesive: "The mixture forms a modeled adhesive network.",
    solid: "Heat and cure conditions form a solid; detailed curing chemistry is simplified.",
    clumps: "The reaction happens too early or too locally, producing clumps instead of a uniform mix.",
    dangerous: "DANGEROUS — the modeled reaction can release hydrogen and must not be attempted.",
  };
  const summary = summaryByProduct[product];
  const warningsDeduplicated = warnings.filter(
    (warning, index) => warnings.findIndex((item) => item.text === warning.text) === index,
  );

  return {
    product,
    productLabel: productLabel(product),
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
    events: eventResults,
    warnings: warningsDeduplicated,
    notModelled: notModelled,
    confidence: roundTo(confidence, 2),
  };
}

export { effectivePH, solventBoilingPointC, waterBoilingPointC };
