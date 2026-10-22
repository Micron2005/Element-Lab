import type { AtomSymbol } from "./atoms";
import {
  KNOWN_MOLECULES,
  checkMolecule,
  identify,
  type MolGraph,
} from "./molecule";
import { analyzeNucleus, bindingEnergy } from "../nuclear";
import { decayChain, neutronHit } from "../nuclearScene";
import { benchById } from "../bench/library";
import { benchPresets } from "../bench/presets";
import { DEFAULT_CONDITIONS } from "../bench/conditions";
import type { Experiment, RunResult } from "../bench/types";

export type Chapter = "molecules" | "mixing" | "atoms";
export type Stars = 0 | 1 | 2 | 3;

export interface Grade {
  stars: Stars;
  feedback: string[];
}

export interface QuestBase {
  id: string;
  chapter: Chapter;
  title: string;
  story: string;
  goal: string;
  hint: string;
  learn: string;
  starGoals: [string, string, string];
}

export interface MoleculeQuest extends QuestBase {
  chapter: "molecules";
  moleculeId: string;
  palette: AtomSymbol[];
}

export interface MixQuest extends QuestBase {
  chapter: "mixing";
  reference: Experiment;
  grade(experiment: Experiment, result: RunResult): Grade;
}

export interface AtomQuest extends QuestBase {
  chapter: "atoms";
  reference: { z: number; n: number };
  grade(z: number, n: number): Grade;
}

export type Quest = MoleculeQuest | MixQuest | AtomQuest;

const moleculeStarGoals: [string, string, string] = [
  "Build the correct, complete molecule.",
  "Use no more than one hint.",
  "Build it without hints.",
];

const moleculeQuests: MoleculeQuest[] = [
  {
    id: "molecule-hydrogen",
    chapter: "molecules",
    title: "Two hydrogen atoms",
    story: "A tiny gas molecule is the first sketch on your lab console.",
    goal: "Connect two hydrogen atoms to make H₂.",
    hint: "Each hydrogen needs one bond.",
    learn: "Hydrogen gas is H₂, with one shared pair of electrons between its atoms.",
    starGoals: moleculeStarGoals,
    moleculeId: "hydrogen",
    palette: ["H"],
  },
  {
    id: "molecule-water",
    chapter: "molecules",
    title: "Water's bent shape",
    story: "The lab needs a familiar molecule before the next sample arrives.",
    goal: "Build one oxygen bonded to two hydrogens.",
    hint: "Oxygen has room for two bonds; each hydrogen has room for one.",
    learn: "Water is H₂O, and lone electron pairs make its shape bent rather than straight.",
    starGoals: moleculeStarGoals,
    moleculeId: "water",
    palette: ["H", "O"],
  },
  {
    id: "molecule-oxygen",
    chapter: "molecules",
    title: "Oxygen's double bond",
    story: "A sensor flags a simple gas molecule in the air sample.",
    goal: "Connect two oxygen atoms with a double bond.",
    hint: "Oxygen has valence two, so the pair can share two bonds.",
    learn: "An oxygen molecule is O₂, held together by a double bond.",
    starGoals: moleculeStarGoals,
    moleculeId: "oxygen",
    palette: ["O", "H"],
  },
  {
    id: "molecule-carbon-dioxide",
    chapter: "molecules",
    title: "A straight carbon dioxide",
    story: "A greenhouse monitor needs you to sketch the gas it just detected.",
    goal: "Put carbon between two oxygen atoms and make two double bonds.",
    hint: "Carbon needs four bonds, and each oxygen needs two.",
    learn: "Carbon dioxide is linear because its central carbon has two double-bonded neighbors.",
    starGoals: moleculeStarGoals,
    moleculeId: "carbon-dioxide",
    palette: ["C", "O", "H"],
  },
  {
    id: "molecule-methane",
    chapter: "molecules",
    title: "Four corners of methane",
    story: "A fuel sensor has found the smallest hydrocarbon in its sample.",
    goal: "Build one carbon with four single-bonded hydrogens.",
    hint: "Carbon has four available bonds; hydrogen has one.",
    learn: "Methane is CH₄, with four bonds arranged around carbon in a tetrahedral shape.",
    starGoals: moleculeStarGoals,
    moleculeId: "methane",
    palette: ["C", "H"],
  },
  {
    id: "molecule-ammonia",
    chapter: "molecules",
    title: "Ammonia's little pyramid",
    story: "A sample label is smudged, but the atom counts are still on the scanner.",
    goal: "Connect three hydrogens to one nitrogen.",
    hint: "Nitrogen needs three bonds, and hydrogen needs one.",
    learn: "Ammonia is NH₃; a lone pair on nitrogen gives it a trigonal-pyramidal shape.",
    starGoals: moleculeStarGoals,
    moleculeId: "ammonia",
    palette: ["N", "H", "C"],
  },
  {
    id: "molecule-nitrogen",
    chapter: "molecules",
    title: "Nitrogen's triple bond",
    story: "The air sample is quiet, but one very strong bond holds its main gas together.",
    goal: "Connect two nitrogen atoms with a triple bond.",
    hint: "Each nitrogen has valence three, so the pair can share three bonds.",
    learn: "Nitrogen gas is N₂; its triple bond helps make it unusually stable.",
    starGoals: moleculeStarGoals,
    moleculeId: "nitrogen",
    palette: ["N"],
  },
  {
    id: "molecule-hydrogen-peroxide",
    chapter: "molecules",
    title: "A peroxide link",
    story: "A cleaning-product label gives you a new oxygen-rich structure to inspect.",
    goal: "Build two oxygens joined together, with one hydrogen on each.",
    hint: "The O–O bond is single, and each oxygen needs one more bond to hydrogen.",
    learn: "Hydrogen peroxide is H₂O₂ and contains a single bond between its oxygen atoms.",
    starGoals: moleculeStarGoals,
    moleculeId: "hydrogen-peroxide",
    palette: ["H", "O"],
  },
  {
    id: "molecule-ethylene",
    chapter: "molecules",
    title: "A double-bonded pair",
    story: "A fruit-ripening sensor found a small molecule with two carbons.",
    goal: "Build two carbons with a double bond and two hydrogens on each.",
    hint: "The C=C bond uses two valence units on each carbon.",
    learn: "Ethylene is C₂H₄, and its carbon-carbon double bond keeps the atoms in a mostly flat arrangement.",
    starGoals: moleculeStarGoals,
    moleculeId: "ethylene",
    palette: ["C", "H"],
  },
  {
    id: "molecule-hydrogen-cyanide",
    chapter: "molecules",
    title: "The carbon–nitrogen triple bond",
    story: "A detector reports a molecule that needs careful handling even in a simulation.",
    goal: "Arrange hydrogen, carbon, and nitrogen in a line with a C≡N bond.",
    hint: "Hydrogen uses one bond; carbon can use one to H and three to N.",
    learn: "Hydrogen cyanide is linear, with a triple bond between carbon and nitrogen.",
    starGoals: moleculeStarGoals,
    moleculeId: "hydrogen-cyanide",
    palette: ["H", "C", "N"],
  },
  {
    id: "molecule-ethanol",
    chapter: "molecules",
    title: "Follow the –OH group",
    story: "Two molecules share a formula, so the lab asks you to identify ethanol by its connections.",
    goal: "Build a two-carbon chain ending in an O–H group.",
    hint: "The oxygen is bonded to one carbon and one hydrogen.",
    learn: "Ethanol and dimethyl ether both have formula C₂H₆O, but their atom connections are different.",
    starGoals: moleculeStarGoals,
    moleculeId: "ethanol",
    palette: ["C", "H", "O"],
  },
  {
    id: "molecule-acetic-acid",
    chapter: "molecules",
    title: "Vinegar's molecule",
    story: "A familiar kitchen sample is waiting for its molecular identity check.",
    goal: "Build a two-carbon carboxylic acid with a C=O and an O–H.",
    hint: "The carbonyl carbon is also bonded to a methyl carbon and a single-bonded oxygen.",
    learn: "Acetic acid is the acid that gives vinegar its sour taste.",
    starGoals: moleculeStarGoals,
    moleculeId: "acetic-acid",
    palette: ["C", "H", "O"],
  },
];

export function gradeMolecule(
  quest: MoleculeQuest,
  g: MolGraph,
  hintsUsed: number,
): Grade {
  const target = KNOWN_MOLECULES.find((molecule) => molecule.id === quest.moleculeId);
  if (!target) return { stars: 0, feedback: ["This molecule is not in the lab library yet."] };

  const checked = checkMolecule(g);
  if (!checked.complete) {
    return {
      stars: 0,
      feedback: checked.problems.length > 0 ? checked.problems : ["Finish connecting the atoms and their bonds."],
    };
  }

  const built = checked.match ?? identify(g);
  if (built?.id !== target.id) {
    const builtName = built ? built.name[0].toLowerCase() + built.name.slice(1) : "";
    const targetName = target.name[0].toLowerCase() + target.name.slice(1);
    return {
      stars: 0,
      feedback: built
        ? [`That's ${builtName}, not ${targetName}.`]
        : ["That complete structure is not one of the molecules in this lab."],
    };
  }

  const hintCount = Number.isFinite(hintsUsed) ? Math.max(0, Math.floor(hintsUsed)) : 0;
  if (hintCount === 0) {
    return { stars: 3, feedback: [`You built ${target.name} with every valence filled.`, "No hints used—three stars!"] };
  }
  if (hintCount === 1) {
    return { stars: 2, feedback: [`You built ${target.name} with every valence filled.`, "Use no hints next time for the final star."] };
  }
  return { stars: 1, feedback: [`You built ${target.name} with every valence filled.`, "Try using one hint or fewer for another star."] };
}

export const MIX_THRESHOLDS = {
  slimeElongationPct: 40,
  filmCostPerKg: 1,
  adhesiveTack: 4.8,
  fiberTensileMPa: 800,
  fiberElongationPct: 15,
  skinSafeHazard: 1,
};

function presetExperiment(id: string): Experiment {
  const preset = benchPresets.find((item) => item.id === id);
  if (!preset) throw new Error(`Missing bench preset: ${id}`);
  return {
    parts: preset.experiment.parts.map((part) => ({ ...part })),
    conditions: { ...preset.experiment.conditions },
  };
}

function experiment(parts: Experiment["parts"], conditions: Partial<Experiment["conditions"]> = {}): Experiment {
  return {
    parts,
    conditions: { ...DEFAULT_CONDITIONS, ...conditions },
  };
}

const spiderConditions = presetExperiment("spider-web").conditions;

const enzymeEventIds: Record<string, string[]> = {
  transglutaminase: ["transglutaminase"],
  "phenol-oxidase": ["tyrosinase", "laccase"],
  "hrp-crosslinking": ["hrp"],
  "protease-digestion": ["trypsin", "papain", "proteinase-k"],
};

function activeEnzymeIds(experiment: Experiment, result: RunResult): string[] {
  const activeEvents = new Set(
    result.events
      .filter((event) => event.status === "happened" || event.status === "partial")
      .filter((event) => event.id in enzymeEventIds)
      .map((event) => event.id),
  );
  return [...new Set(experiment.parts
    .filter((part) => part.pct > 0 && benchById[part.id]?.enzyme)
    .filter((part) => Object.entries(enzymeEventIds).some(
      ([eventId, enzymeIds]) => activeEvents.has(eventId) && enzymeIds.includes(part.id),
    ))
    .map((part) => part.id))];
}

const mixQuests: MixQuest[] = [
  {
    id: "mix-fizz",
    chapter: "mixing",
    title: "Make it fizz",
    story: "The lab's bubble counter needs a harmless-looking gas event to study.",
    goal: "Make the acid-and-bicarbonate fizz event happen.",
    hint: "Look for an acid and sodium bicarbonate in the ingredient library.",
    learn: "An acid can react with bicarbonate to release carbon dioxide bubbles.",
    starGoals: [
      "The bicarbonate-bubbles event happens.",
      "The product is not dangerous.",
      "Every ingredient is edible in the model.",
    ],
    reference: presetExperiment("baking-soda-vinegar"),
    grade: (_experiment, result) => {
      const event = result.events.find((item) => item.id === "bicarbonate-bubbles");
      if (event?.status !== "happened") {
        return {
          stars: 0,
          feedback: [event?.status === "partial" ? "The fizz is only partial; make the event happen fully." : "The bicarbonate-bubbles event has not happened yet."],
        };
      }
      if (result.product === "dangerous") {
        return { stars: 1, feedback: ["The fizz happened.", "Keep the product from being dangerous for another star."] };
      }
      if (!result.edible) {
        return { stars: 2, feedback: ["The fizz happened and the product is not dangerous.", "Use only edible ingredients for the final star."] };
      }
      return { stars: 3, feedback: ["The fizz happened.", "The product is not dangerous.", "Every ingredient is edible in the model."] };
    },
  },
  {
    id: "mix-slime",
    chapter: "mixing",
    title: "Slime time",
    story: "A stretchy sample has arrived at the bench; the lab wants to know what gives it bounce.",
    goal: "Make a gel or slime, then improve its stretch and skin-hazard rating.",
    hint: "Borate links can connect PVA chains, and glycerol may change stretch.",
    learn: "Borate ions make reversible links between PVA chains, allowing slime to stretch and partly self-heal.",
    starGoals: [
      "The product is a gel or slime.",
      `Elongation is at least ${MIX_THRESHOLDS.slimeElongationPct}%.`,
      `Skin hazard is level ${MIX_THRESHOLDS.skinSafeHazard} or lower.`,
    ],
    reference: presetExperiment("borax-slime"),
    grade: (_experiment, result) => {
      if (result.product !== "gel" && result.product !== "slime") {
        return { stars: 0, feedback: ["The product is not a gel or slime yet."] };
      }
      if (result.elongationPct < MIX_THRESHOLDS.slimeElongationPct) {
        return {
          stars: 1,
          feedback: ["You formed a gel or slime.", `Reach ${MIX_THRESHOLDS.slimeElongationPct}% elongation for another star.`],
        };
      }
      if (result.skin > MIX_THRESHOLDS.skinSafeHazard) {
        return {
          stars: 2,
          feedback: [`The sample stretches ${Math.round(result.elongationPct)}%.`, "Lower the skin hazard to level 1 or below for the final star."],
        };
      }
      return { stars: 3, feedback: ["You formed a gel or slime.", "The sample stretches well.", "Skin hazard is at the safest modeled level."] };
    },
  },
  {
    id: "mix-vanishing-film",
    chapter: "mixing",
    title: "Vanishing film",
    story: "The cleanup crew wants a castable film that can disappear in water.",
    goal: "Form a water-dissolving film from biodegradable ingredients without overspending.",
    hint: "PVA can form a film when cast and is modeled as biodegradable and water-soluble.",
    learn: "Some polymer films dissolve in water; their behavior depends on the polymer and the way the film is formed.",
    starGoals: [
      "The product is a film and dissolves in water.",
      "Every ingredient is biodegradable.",
      `Modeled cost is at most $${MIX_THRESHOLDS.filmCostPerKg.toFixed(2)} per kg.`,
    ],
    reference: experiment(
      [{ id: "pva", pct: 12 }, { id: "water", pct: 88 }],
      { forming: "cast-film" },
    ),
    grade: (_experiment, result) => {
      if (result.product !== "film" || result.water !== "dissolves") {
        return { stars: 0, feedback: ["Make a film that is modeled to dissolve in water."] };
      }
      if (!result.biodegradable) {
        return { stars: 1, feedback: ["You formed a dissolving film.", "Use biodegradable ingredients for another star."] };
      }
      if (result.costPerKg > MIX_THRESHOLDS.filmCostPerKg) {
        return {
          stars: 2,
          feedback: ["You formed a dissolving film from biodegradable ingredients.", `Lower the modeled cost to $${MIX_THRESHOLDS.filmCostPerKg.toFixed(2)}/kg for the final star.`],
        };
      }
      return { stars: 3, feedback: ["The film dissolves in water.", "Every ingredient is biodegradable.", "The modeled cost is within budget."] };
    },
  },
  {
    id: "mix-sticky-situation",
    chapter: "mixing",
    title: "Sticky situation",
    story: "A sample must hold two surfaces together without making the lab crew nervous.",
    goal: "Form an adhesive with useful tack and a low skin-hazard score.",
    hint: "Mussel foot protein contains catechol groups that can form adhesive links.",
    learn: "Catechol groups can oxidize into links that help some natural proteins adhere to surfaces.",
    starGoals: [
      "The product is an adhesive.",
      `Tack is at least ${MIX_THRESHOLDS.adhesiveTack}/10.`,
      `Skin hazard is level ${MIX_THRESHOLDS.skinSafeHazard} or lower.`,
    ],
    reference: experiment([
      { id: "mfp5", pct: 20 },
      { id: "water", pct: 78 },
      { id: "sodium-bicarbonate", pct: 2 },
    ]),
    grade: (_experiment, result) => {
      if (result.product !== "adhesive") {
        return { stars: 0, feedback: ["The mixture has not formed an adhesive."] };
      }
      if (result.tack < MIX_THRESHOLDS.adhesiveTack) {
        return {
          stars: 1,
          feedback: ["You formed an adhesive.", `Reach ${MIX_THRESHOLDS.adhesiveTack}/10 tack for another star.`],
        };
      }
      if (result.skin > MIX_THRESHOLDS.skinSafeHazard) {
        return { stars: 2, feedback: ["The adhesive has useful tack.", "Lower the skin hazard to level 1 or below for the final star."] };
      }
      return { stars: 3, feedback: ["You formed an adhesive.", "Its tack meets the target.", "Skin hazard is at the safe modeled level."] };
    },
  },
  {
    id: "mix-strand",
    chapter: "mixing",
    title: "Strand you can hang from",
    story: "A tiny fiber model needs enough strength to carry a load and enough stretch to bend.",
    goal: "Form a fiber with a strong network and at least 15% elongation.",
    hint: "Silk can form stronger beta-sheet regions; a little plasticizer can increase stretch.",
    learn: "Fiber strength and stretch are separate properties, and changing one can trade off against the other.",
    starGoals: [
      "The product is a fiber.",
      `Tensile strength is at least ${MIX_THRESHOLDS.fiberTensileMPa} MPa.`,
      `Elongation is at least ${MIX_THRESHOLDS.fiberElongationPct}%.`,
    ],
    reference: {
      parts: [
        { id: "spider-silk", pct: 55 },
        { id: "water", pct: 30 },
        { id: "ethanol", pct: 5 },
        { id: "glycerol", pct: 10 },
      ],
      conditions: { ...spiderConditions },
    },
    grade: (_experiment, result) => {
      if (result.product !== "fiber") return { stars: 0, feedback: ["The forming conditions have not made a fiber."] };
      if (result.tensileMPa < MIX_THRESHOLDS.fiberTensileMPa) {
        return {
          stars: 1,
          feedback: ["You formed a fiber.", `Reach ${MIX_THRESHOLDS.fiberTensileMPa} MPa tensile strength for another star.`],
        };
      }
      if (result.elongationPct < MIX_THRESHOLDS.fiberElongationPct) {
        return {
          stars: 2,
          feedback: ["The fiber meets the strength target.", `Reach ${MIX_THRESHOLDS.fiberElongationPct}% elongation for the final star.`],
        };
      }
      return { stars: 3, feedback: ["You formed a fiber.", "The fiber meets the strength target.", "It stretches at least 15%."] };
    },
  },
  {
    id: "mix-enzyme-helper",
    chapter: "mixing",
    title: "Enzyme helper",
    story: "A protein network needs a helpful enzyme, and the lab's pH meter is part of the puzzle.",
    goal: "Activate an enzyme event and tune the pH toward that enzyme's working range and optimum.",
    hint: "Check the enzyme's pH range and optimum in the ingredient information.",
    learn: "Enzymes work best under particular conditions, and a pH shift can change how active they are.",
    starGoals: [
      "An enzyme event has activity (happened or partial).",
      "The pH is within the active enzyme's range.",
      "The pH is within 1 unit of that enzyme's optimum.",
    ],
    reference: experiment([
      { id: "gelatin", pct: 30 },
      { id: "water", pct: 67.999 },
      { id: "trypsin", pct: 2 },
      { id: "sodium-bicarbonate", pct: 0.001 },
    ], { tempC: 37 }),
    grade: (run, result) => {
      const enzymeIds = activeEnzymeIds(run, result);
      if (enzymeIds.length === 0) {
        return { stars: 0, feedback: ["No enzyme reaction is active yet; check the ingredients and conditions."] };
      }
      const enzymes = enzymeIds.flatMap((id) => {
        const enzyme = benchById[id]?.enzyme;
        return enzyme ? [enzyme] : [];
      });
      const inRange = enzymes.some(
        (enzyme) => result.effectivePH >= enzyme.pHRange[0] && result.effectivePH <= enzyme.pHRange[1],
      );
      const nearOptimum = enzymes.some(
        (enzyme) => Math.abs(result.effectivePH - enzyme.optPH) <= 1,
      );
      const activeEvent = result.events.find(
        (event) => event.id in enzymeEventIds && (event.status === "happened" || event.status === "partial"),
      );
      const partial = activeEvent?.status === "partial";
      if (!inRange) {
        return {
          stars: 1,
          feedback: [partial ? "A partial enzyme reaction is active." : "An enzyme reaction happened.", "Move the pH into the enzyme's working range for another star."],
        };
      }
      if (!nearOptimum) {
        return {
          stars: 2,
          feedback: ["An enzyme reaction is active and the pH is in range.", `Move pH within 1 unit of the enzyme optimum for the final star (current pH ${result.effectivePH.toFixed(1)}).`],
        };
      }
      return { stars: 3, feedback: ["An enzyme reaction is active.", "The pH is within its working range.", "The pH is within 1 unit of the enzyme optimum."] };
    },
  },
];

export const NUCLEAR_THRESHOLDS = {
  splitEnergyMeV: 150,
  longLivedYears: 1,
  bindingOneStarFraction: 0.5,
  bindingTwoStarFraction: 0.9,
  bindingThreeStarFraction: 0.99,
  newElementTwoStarSeconds: 1e-6,
  newElementThreeStarSeconds: 1e-3,
};

function findPeakBindingPerNucleon(): number {
  let maximum = 0;
  for (let z = 1; z <= 120; z += 1) {
    const minimumN = Math.max(1, Math.floor(z * 0.7));
    const maximumN = Math.ceil(z * 1.8) + 20;
    for (let n = minimumN; n <= maximumN; n += 1) {
      const report = analyzeNucleus(z, n);
      if (report.bound && z + n > 1) {
        maximum = Math.max(maximum, bindingEnergy(z, n) / (z + n));
      }
    }
  }
  return maximum;
}

export const MAX_BINDING_PER_NUCLEON = findPeakBindingPerNucleon();

const YEAR_SECONDS = 365.25 * 24 * 60 * 60;

function halfLifeSeconds(halfLife: string): number {
  if (halfLife.startsWith("Stable")) return Number.POSITIVE_INFINITY;
  if (halfLife.includes("< 10^-21")) return 0;
  const match = /([\d.]+(?:e[+-]?\d+)?)\s*(years|hours|ms|s)\b/i.exec(halfLife);
  if (!match) return 0;
  const amount = Number(match[1]);
  switch (match[2].toLowerCase()) {
    case "years":
      return amount * YEAR_SECONDS;
    case "hours":
      return amount * 60 * 60;
    case "ms":
      return amount / 1000;
    default:
      return amount;
  }
}

function validNucleus(z: number, n: number): boolean {
  return Number.isInteger(z) && Number.isFinite(z) && z > 0 &&
    Number.isInteger(n) && Number.isFinite(n) && n > 0;
}

function invalidNucleusGrade(): Grade {
  return { stars: 0, feedback: ["Enter positive whole-number proton and neutron counts."] };
}

const atomQuests: AtomQuest[] = [
  {
    id: "atom-split",
    chapter: "atoms",
    title: "Split the atom",
    story: "The nucleus simulator is ready for a neutron-capture challenge.",
    goal: "Find a long-lived target that splits after capturing a neutron.",
    hint: "Uranium-235 is the reference target in this model.",
    learn: "Fission splits a heavy nucleus into lighter fragments and releases energy; the model's fragments are estimates.",
    starGoals: [
      "Neutron capture triggers fission.",
      `The modeled energy is at least ${NUCLEAR_THRESHOLDS.splitEnergyMeV} MeV.`,
      `The starting nucleus has a modeled half-life of at least ${NUCLEAR_THRESHOLDS.longLivedYears} year.`,
    ],
    reference: { z: 92, n: 143 },
    grade: (z, n) => {
      if (!validNucleus(z, n)) return invalidNucleusGrade();
      try {
        const split = neutronHit(z, n);
        if (split.kind !== "fission") {
          return { stars: 0, feedback: ["This target captures a neutron but does not fission in the model."] };
        }
        const report = analyzeNucleus(z, n);
        if (split.energyMeV < NUCLEAR_THRESHOLDS.splitEnergyMeV) {
          return {
            stars: 1,
            feedback: ["Neutron capture triggers fission.", `Reach ${NUCLEAR_THRESHOLDS.splitEnergyMeV} MeV for another star.`],
          };
        }
        if (halfLifeSeconds(report.halfLife) < NUCLEAR_THRESHOLDS.longLivedYears * YEAR_SECONDS) {
          return {
            stars: 2,
            feedback: [`The modeled fission releases ${Math.round(split.energyMeV)} MeV.`, "Choose a starting nucleus with a modeled half-life of at least one year for the final star."],
          };
        }
        return { stars: 3, feedback: ["Neutron capture triggers fission.", "The modeled energy exceeds 150 MeV.", "The starting nucleus is long-lived in this model."] };
      } catch {
        return invalidNucleusGrade();
      }
    },
  },
  {
    id: "atom-tightest",
    chapter: "atoms",
    title: "Tightest nucleus",
    story: "The model is scanning for nuclei whose particles are held together especially tightly.",
    goal: "Explore binding energy per nucleon and find a nucleus near the model's peak.",
    hint: "The strongest region in this model is around iron and nickel.",
    learn: "Binding energy per nucleon is a measure of how tightly the nucleons are held together.",
    starGoals: [
      `Reach at least ${(MAX_BINDING_PER_NUCLEON * NUCLEAR_THRESHOLDS.bindingOneStarFraction).toFixed(2)} MeV per nucleon.`,
      `Reach at least ${(MAX_BINDING_PER_NUCLEON * NUCLEAR_THRESHOLDS.bindingTwoStarFraction).toFixed(2)} MeV per nucleon.`,
      `Reach at least ${(MAX_BINDING_PER_NUCLEON * NUCLEAR_THRESHOLDS.bindingThreeStarFraction).toFixed(2)} MeV per nucleon.`,
    ],
    reference: { z: 26, n: 32 },
    grade: (z, n) => {
      if (!validNucleus(z, n)) return invalidNucleusGrade();
      try {
        const report = analyzeNucleus(z, n);
        if (!report.bound || report.perNucleonMeV < MAX_BINDING_PER_NUCLEON * NUCLEAR_THRESHOLDS.bindingOneStarFraction) {
          return { stars: 0, feedback: ["This nucleus is not bound tightly enough in the model yet."] };
        }
        if (report.perNucleonMeV < MAX_BINDING_PER_NUCLEON * NUCLEAR_THRESHOLDS.bindingTwoStarFraction) {
          return { stars: 1, feedback: [`Binding energy is ${report.perNucleonMeV.toFixed(2)} MeV per nucleon.`, "Move closer to the iron/nickel peak for another star."] };
        }
        if (report.perNucleonMeV < MAX_BINDING_PER_NUCLEON * NUCLEAR_THRESHOLDS.bindingThreeStarFraction) {
          return { stars: 2, feedback: [`Binding energy is ${report.perNucleonMeV.toFixed(2)} MeV per nucleon.`, "Reach the near-peak iron/nickel region for the final star."] };
        }
        return { stars: 3, feedback: [`Binding energy is ${report.perNucleonMeV.toFixed(2)} MeV per nucleon.`, "That is within 1% of the model's maximum."] };
      } catch {
        return invalidNucleusGrade();
      }
    },
  },
  {
    id: "atom-alpha",
    chapter: "atoms",
    title: "Alpha particle",
    story: "Follow a decay chain and watch a small bundle of nuclear matter leave the nucleus.",
    goal: "Start with alpha decay, then follow the chain toward a stable nucleus.",
    hint: "Uranium-238 begins with alpha decay in the model.",
    learn: "An alpha particle contains two protons and two neutrons, so alpha decay lowers both counts by two.",
    starGoals: [
      "The first step is alpha decay.",
      "Follow at least three decay steps.",
      "The chain ends at a stable nucleus in the model.",
    ],
    reference: { z: 92, n: 146 },
    grade: (z, n) => {
      if (!validNucleus(z, n)) return invalidNucleusGrade();
      try {
        const chain = decayChain(z, n, 32);
        if (chain[0]?.kind !== "alpha") {
          return { stars: 0, feedback: ["The first decay step is not alpha emission in the model."] };
        }
        if (chain.length < 3) {
          return { stars: 1, feedback: ["The first step is alpha decay.", "Follow at least three steps for another star."] };
        }
        if (chain[chain.length - 1].kind !== "stable") {
          return { stars: 2, feedback: [`You followed ${chain.length} steps beginning with alpha decay.`, "Find a chain that reaches a stable nucleus for the final star."] };
        }
        return { stars: 3, feedback: ["The first step is alpha decay.", `The chain includes ${chain.length} steps.`, "It ends at a stable nucleus in the model."] };
      } catch {
        return invalidNucleusGrade();
      }
    },
  },
  {
    id: "atom-new-element",
    chapter: "atoms",
    title: "Make your own element",
    story: "A theoretical isotope is waiting in the simulator's superheavy region.",
    goal: "Find a bound nucleus above element 118 and see how long the model lets it last.",
    hint: "The model gives extra stability to some neutron counts, including magic numbers.",
    learn: "Real new elements are made a few atoms at a time in particle accelerators; a model nucleus is a prediction, not a real element.",
    starGoals: [
      "Choose a bound target with Z ≥ 119 that does not drip a nucleon.",
      `Reach a modeled half-life of at least ${NUCLEAR_THRESHOLDS.newElementTwoStarSeconds * 1e6} microseconds.`,
      `Reach a modeled half-life of at least ${NUCLEAR_THRESHOLDS.newElementThreeStarSeconds * 1e3} milliseconds.`,
    ],
    reference: { z: 120, n: 244 },
    grade: (z, n) => {
      if (!validNucleus(z, n)) return invalidNucleusGrade();
      if (z < 119) return { stars: 0, feedback: ["Choose Z ≥ 119 to explore a new element in the model."] };
      try {
        const report = analyzeNucleus(z, n);
        const first = decayChain(z, n, 1)[0];
        if (!report.bound || first?.kind === "neutron-drip" || first?.kind === "proton-drip") {
          return { stars: 0, feedback: ["This nucleus is not bound without a nucleon drip in the model."] };
        }
        const lifetime = halfLifeSeconds(report.halfLife);
        if (lifetime < NUCLEAR_THRESHOLDS.newElementTwoStarSeconds) {
          return { stars: 1, feedback: ["The model finds a bound nucleus above Z 118.", "Reach a half-life of at least 1 microsecond for another star."] };
        }
        if (lifetime < NUCLEAR_THRESHOLDS.newElementThreeStarSeconds) {
          return { stars: 2, feedback: ["The model finds a bound nucleus above Z 118.", "Its modeled half-life reaches 1 microsecond.", "Reach 1 millisecond for the final star."] };
        }
        return { stars: 3, feedback: ["The nucleus is bound and does not drip a nucleon.", "Its modeled half-life exceeds 1 microsecond.", "Its modeled half-life exceeds 1 millisecond."] };
      } catch {
        return invalidNucleusGrade();
      }
    },
  },
];

export const QUESTS: Quest[] = [...moleculeQuests, ...mixQuests, ...atomQuests];

export const CHAPTERS: { id: Chapter; title: string; blurb: string }[] = [
  { id: "molecules", title: "Molecule builder", blurb: "Connect atoms and see how bonds shape familiar molecules." },
  { id: "mixing", title: "Mixture lab", blurb: "Use the real bench model to test ingredients and conditions." },
  { id: "atoms", title: "Nuclear stories", blurb: "Explore what a simplified nucleus model predicts." },
];

export function questById(id: string): Quest | undefined {
  return QUESTS.find((quest) => quest.id === id);
}

export function questsIn(chapter: Chapter): Quest[] {
  return QUESTS.filter((quest) => quest.chapter === chapter);
}
