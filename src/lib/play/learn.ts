import { fmtTime, hazardWord } from "../formula";
import { benchById } from "../bench/library";
import type { Experiment, RunResult } from "../bench/types";
import { analyzeNucleus } from "../nuclear";
import { decayChain, neutronHit } from "../nuclearScene";
import { prettyFormula, type KnownMolecule } from "./molecule";
import type { AtomQuest, MixQuest } from "./quests";

export interface LearnSection {
  heading: string;
  body: string;
}

export interface LearnCard {
  title: string;
  sections: LearnSection[];
  usedFor: string[];
  askPrompt: string;
  context: string;
}

interface Lesson {
  whatItIs: string;
  whatItDoes: string;
  whyItMatters: string;
  usedFor: string[];
}

interface MoleculeLesson extends Lesson {
  whyShape: string;
}

export const MOLECULE_LESSONS: Record<string, MoleculeLesson> = {
  hydrogen: {
    whatItIs: "Hydrogen gas is H₂: two hydrogen atoms joined by a single covalent bond.",
    whyShape: "The atoms share one pair of electrons. With only two atoms there is no central bond angle, so the molecule is linear.",
    whatItDoes: "Hydrogen is a very light gas and can release energy when it reacts with oxygen.",
    whyItMatters: "It is the simplest molecule and a useful example of how sharing electrons can hold atoms together. Hydrogen gas is highly flammable.",
    usedFor: ["fuel cells", "some industrial chemical production", "research on stars and planetary atmospheres"],
  },
  oxygen: {
    whatItIs: "Oxygen gas is O₂, the form of oxygen that makes up about one fifth of dry air.",
    whyShape: "The two oxygen atoms share a double bond, and a two-atom molecule is linear.",
    whatItDoes: "Living things use oxygen in cellular respiration, and oxygen supports many combustion reactions.",
    whyItMatters: "The O=O bond makes oxygen a stable molecule, while its reactivity helps power important processes in life and industry.",
    usedFor: ["medical oxygen under professional care", "steelmaking", "water treatment"],
  },
  nitrogen: {
    whatItIs: "Nitrogen gas is N₂, the main component of Earth's atmosphere.",
    whyShape: "The nitrogen atoms share a triple bond. A molecule with just two atoms is linear, with a 180° arrangement.",
    whatItDoes: "Its strong bond makes nitrogen gas relatively unreactive under ordinary conditions.",
    whyItMatters: "Nitrogen is essential to proteins and DNA, but most organisms cannot use atmospheric N₂ directly.",
    usedFor: ["making fertilizers", "protective atmospheres in food packaging", "cooling with liquid nitrogen in supervised settings"],
  },
  water: {
    whatItIs: "Water is H₂O: one oxygen atom bonded to two hydrogen atoms.",
    whyShape: "Oxygen has two O–H single bonds and two lone pairs. The lone pairs push the bonds into a bent shape with an angle of about 104.5°.",
    whatItDoes: "Water is a polar liquid that dissolves many substances and helps move heat and materials around.",
    whyItMatters: "Its polarity and hydrogen bonding help make liquid water an unusually effective medium for life's chemistry.",
    usedFor: ["drinking water and cooking", "cooling in power plants and engines", "the solvent in many laboratory reactions"],
  },
  "carbon-dioxide": {
    whatItIs: "Carbon dioxide is CO₂, a molecule with one carbon atom between two oxygen atoms.",
    whyShape: "The central carbon makes two C=O double bonds and has no lone pairs, so the bonds point in opposite directions at 180°.",
    whatItDoes: "Plants use carbon dioxide in photosynthesis, and it also absorbs infrared radiation in the atmosphere.",
    whyItMatters: "CO₂ is part of the carbon cycle, and changes in its atmospheric amount affect Earth's climate.",
    usedFor: ["carbonated drinks", "greenhouse and climate monitoring", "some fire-suppression systems"],
  },
  methane: {
    whatItIs: "Methane is CH₄, the smallest molecule made from carbon and hydrogen.",
    whyShape: "Carbon makes four single bonds to hydrogen. They spread into a tetrahedral arrangement with angles near 109.5°.",
    whatItDoes: "Methane is a fuel, but it is also a powerful greenhouse gas when released into the atmosphere.",
    whyItMatters: "Understanding methane connects molecular structure to both energy use and climate science. It is highly flammable and can displace oxygen in enclosed spaces.",
    usedFor: ["fuel in natural gas systems", "industrial heat", "climate and atmospheric research"],
  },
  ammonia: {
    whatItIs: "Ammonia is NH₃, with one nitrogen atom bonded to three hydrogen atoms.",
    whyShape: "Nitrogen has three N–H single bonds and one lone pair. The lone pair pushes the bonds into a trigonal-pyramidal shape, about 107°.",
    whatItDoes: "Ammonia is a basic gas that dissolves readily in water and can irritate eyes and airways at high exposure.",
    whyItMatters: "Nitrogen in ammonia can be made available to plants, making it central to modern agriculture.",
    usedFor: ["fertilizers", "industrial refrigeration", "some household and industrial cleaners"],
  },
  "hydrogen-chloride": {
    whatItIs: "Hydrogen chloride is HCl, a molecule containing one hydrogen and one chlorine atom.",
    whyShape: "The atoms share one polar single bond. A two-atom molecule is linear.",
    whatItDoes: "Hydrogen chloride gas dissolves in water to form hydrochloric acid.",
    whyItMatters: "It is an important industrial chemical, but the gas is corrosive and can severely injure the lungs.",
    usedFor: ["making chloride salts in controlled industry", "metal processing", "chemical manufacturing"],
  },
  "hydrogen-peroxide": {
    whatItIs: "Hydrogen peroxide is H₂O₂, with an O–O single bond and one hydrogen attached to each oxygen.",
    whyShape: "Each oxygen has two bonds and two lone pairs; lone-pair repulsion and rotation around the O–O bond make the molecule non-planar, with an angle near 100° at oxygen.",
    whatItDoes: "Hydrogen peroxide can act as an oxidizer and breaks down into water and oxygen.",
    whyItMatters: "It is used in dilute products, but concentrated hydrogen peroxide can burn skin and decompose dangerously.",
    usedFor: ["dilute disinfecting products", "paper and textile bleaching", "some controlled water-treatment processes"],
  },
  "hydrogen-cyanide": {
    whatItIs: "Hydrogen cyanide is HCN, a small molecule with hydrogen bonded to carbon and carbon triple-bonded to nitrogen.",
    whyShape: "The H–C≡N atoms lie in a straight line; the triple bond strongly constrains the carbon–nitrogen connection.",
    whatItDoes: "HCN participates in specialized industrial chemistry, but it is acutely poisonous and can be fatal in tiny amounts.",
    whyItMatters: "Knowing its identity and hazard matters in chemical safety and environmental monitoring; this is not a substance for casual handling.",
    usedFor: ["specialized chemical manufacturing in controlled facilities", "chemical-safety education", "environmental and toxicology monitoring"],
  },
  ethane: {
    whatItIs: "Ethane is C₂H₆, with two carbon atoms joined together and three hydrogens on each carbon.",
    whyShape: "Each carbon makes four single bonds in a roughly tetrahedral arrangement, with angles near 109.5°. The C–C single bond can rotate, so ethane has many conformations.",
    whatItDoes: "Ethane is a flammable gas found in natural gas and used as an industrial feedstock.",
    whyItMatters: "It is a simple example of how single bonds allow parts of a molecule to rotate relative to each other.",
    usedFor: ["petrochemical feedstock", "natural-gas analysis", "combustion and atmospheric research"],
  },
  ethylene: {
    whatItIs: "Ethylene, also called ethene, is C₂H₄ with a carbon–carbon double bond.",
    whyShape: "Each carbon has three regions of electron density around it, giving a mostly flat trigonal-planar arrangement with angles near 120°.",
    whatItDoes: "Ethylene is a plant hormone that helps control fruit ripening and is an important industrial molecule.",
    whyItMatters: "Its C=C double bond is a simple example of how bond order changes shape and chemical behavior. Ethylene gas is flammable.",
    usedFor: ["fruit-ripening studies", "making polyethylene plastics", "monitoring plant and crop storage"],
  },
  acetylene: {
    whatItIs: "Acetylene, or ethyne, is C₂H₂ with a carbon–carbon triple bond and one hydrogen at each end.",
    whyShape: "The triple bond gives each carbon two regions of electron density, so the H–C≡C–H molecule is linear at 180°.",
    whatItDoes: "Acetylene is used as a fuel gas in specialized equipment, but it is extremely flammable and can form explosive mixtures.",
    whyItMatters: "It shows how a triple bond creates a compact, straight molecular skeleton; its hazard is why use is restricted to trained settings.",
    usedFor: ["specialized welding systems", "industrial chemical production", "studying carbon–carbon triple bonds"],
  },
  methanol: {
    whatItIs: "Methanol is CH₃OH, the simplest alcohol, with one carbon bonded to an oxygen-containing –OH group.",
    whyShape: "The carbon has four single bonds in a tetrahedral arrangement with angles near 109.5°. Oxygen also has two lone pairs, which make the C–O–H region bent.",
    whatItDoes: "Methanol is used as a solvent and fuel, but it is poisonous if swallowed or absorbed in significant amounts.",
    whyItMatters: "It is a common industrial molecule whose similarity to drinking alcohol does not make it safe to consume.",
    usedFor: ["industrial solvents", "some fuel applications", "making other chemicals in controlled facilities"],
  },
  ethanol: {
    whatItIs: "Ethanol is C₂H₅OH, a two-carbon alcohol with a terminal –OH group.",
    whyShape: "Each carbon has four single bonds in a roughly tetrahedral arrangement, with angles near 109.5°; the oxygen's two lone pairs make the C–O–H part bent.",
    whatItDoes: "Ethanol is the alcohol in beverages and is also used as a solvent and disinfectant. It is flammable, and drinking it can harm health.",
    whyItMatters: "Its small structure makes ethanol mix with water, while its effects on the brain and body show that familiar molecules can still carry risks.",
    usedFor: ["beverages where legally permitted", "hand and surface disinfectants", "solvents and laboratory cleaning"],
  },
  "dimethyl-ether": {
    whatItIs: "Dimethyl ether is CH₃OCH₃, with an oxygen atom between two carbon groups.",
    whyShape: "Oxygen makes two single bonds and has two lone pairs, so the C–O–C arrangement is bent at about 111°.",
    whatItDoes: "Dimethyl ether is a gas that can be compressed into a liquid and is highly flammable.",
    whyItMatters: "It has the same formula as ethanol but different connectivity, showing why molecular structure—not just atom counts—matters.",
    usedFor: ["aerosol propellants", "some fuel blends", "comparing structural isomers in chemistry"],
  },
  formaldehyde: {
    whatItIs: "Formaldehyde is CH₂O, the simplest molecule containing a carbonyl group.",
    whyShape: "The carbon has a C=O double bond and two C–H single bonds, giving a trigonal-planar arrangement near 120°.",
    whatItDoes: "Formaldehyde is used in industrial materials, but it is toxic and can cause cancer.",
    whyItMatters: "It is important to recognize because it can occur in air and materials, and reducing exposure is a public-health concern.",
    usedFor: ["making resins and composite materials", "preserving biological specimens in controlled settings", "indoor-air monitoring"],
  },
  "formic-acid": {
    whatItIs: "Formic acid is HCOOH, the simplest carboxylic acid.",
    whyShape: "The carboxyl carbon is approximately trigonal planar: it has a C=O double bond and two other single bonds.",
    whatItDoes: "Some ants use formic acid as a defense, and the concentrated acid can corrode and harm skin.",
    whyItMatters: "It connects familiar natural chemistry to industrial uses, while concentration determines how hazardous an acid can be.",
    usedFor: ["leather and textile processing", "agricultural silage treatment", "studying acid chemistry"],
  },
  "acetic-acid": {
    whatItIs: "Acetic acid is CH₃COOH, the two-carbon carboxylic acid that gives vinegar its sourness.",
    whyShape: "The carboxyl carbon is trigonal planar, with one C=O double bond and two single bonds; the methyl carbon is roughly tetrahedral.",
    whatItDoes: "Dilute acetic acid is the acid in vinegar, while more concentrated forms are corrosive.",
    whyItMatters: "It is a useful example of how the same molecule can be familiar in dilute food mixtures and hazardous when concentrated.",
    usedFor: ["vinegar in food", "making acetate materials", "laboratory acid-base demonstrations"],
  },
  "hydrogen-sulfide": {
    whatItIs: "Hydrogen sulfide is H₂S, a sulfur atom bonded to two hydrogen atoms.",
    whyShape: "Sulfur has two S–H single bonds and two lone pairs, making the molecule bent; its bond angle is about 92°.",
    whatItDoes: "It can form as organic matter breaks down and has a rotten-egg odor at low concentrations, but it is highly toxic and can quickly overwhelm smell.",
    whyItMatters: "Recognizing the hazard is essential because odor is not a reliable warning of dangerous exposure.",
    usedFor: ["monitoring sewage and petroleum facilities", "studying sulfur cycling", "environmental safety testing"],
  },
  phosphine: {
    whatItIs: "Phosphine is PH₃, a phosphorus atom bonded to three hydrogen atoms.",
    whyShape: "Phosphorus has three P–H single bonds and one lone pair, giving a trigonal-pyramidal shape with an angle near 93.5°.",
    whatItDoes: "Phosphine is used in specialized semiconductor and research settings, but it is extremely toxic and flammable.",
    whyItMatters: "Its molecular shape resembles ammonia's, while its very different hazard profile shows that similar shapes do not mean similar safety.",
    usedFor: ["specialized semiconductor processes", "research on phosphorus chemistry", "laboratory detection and safety studies"],
  },
  "hydrogen-fluoride": {
    whatItIs: "Hydrogen fluoride is HF, a polar molecule made of one hydrogen and one fluorine atom.",
    whyShape: "The two atoms share a single polar bond. With only two atoms, the molecule is linear.",
    whatItDoes: "HF is used in tightly controlled industrial processes; it is highly corrosive and can cause deep, dangerous burns.",
    whyItMatters: "Its severe hazard is a reminder that a small, simple molecule can cause serious harm even when exposure is limited.",
    usedFor: ["specialized materials processing", "fluorine-containing chemical production", "chemical-safety training"],
  },
  "carbon-tetrachloride": {
    whatItIs: "Carbon tetrachloride is CCl₄, with one carbon atom bonded to four chlorine atoms.",
    whyShape: "Four C–Cl single bonds point toward the corners of a tetrahedron, with angles near 109.5°. Their symmetry cancels the bond dipoles, so the whole molecule is nonpolar.",
    whatItDoes: "It was once widely used as a solvent, but it is toxic and damages the ozone layer, so many uses have been phased out or restricted.",
    whyItMatters: "CCl₄ is a case study in how a useful material can later be limited when health and environmental harms become clear.",
    usedFor: ["historical solvent research", "atmospheric chemistry studies", "chemical-safety education"],
  },
  chloroform: {
    whatItIs: "Chloroform, or trichloromethane, is CHCl₃: one carbon bonded to one hydrogen and three chlorine atoms.",
    whyShape: "The carbon makes four single bonds in a tetrahedral arrangement, with angles near 109.5°, though the different atoms make the molecule asymmetric.",
    whatItDoes: "Chloroform has been used as a solvent and industrial feedstock; exposure can harm the nervous system and liver.",
    whyItMatters: "Its history includes medical use that ended because of serious risks, making it an example of why safety evidence matters.",
    usedFor: ["controlled laboratory solvent use", "specialized chemical manufacturing", "historical and chemical-safety education"],
  },
};

export const QUEST_LESSONS: Record<string, Lesson> = {
  "mix-fizz": {
    whatItIs: "This quest explores an acid reacting with bicarbonate in a water-based mixture.",
    whatItDoes: "The model can represent bicarbonate bubbles as carbon dioxide forms; the exact visible fizz depends on the ingredients and simulated conditions.",
    whyItMatters: "Gas bubbles are evidence that atoms are rearranging into new substances, not just that the ingredients are mixing.",
    usedFor: ["baking and leavening", "antacid chemistry", "teaching acid-base reactions"],
  },
  "mix-slime": {
    whatItIs: "This is a polymer gel made from long PVA chains and borate crosslinks.",
    whatItDoes: "Reversible links between chains let the material deform and stretch, then partly recover.",
    whyItMatters: "Changing crosslink density changes how a soft material flows, stretches, and holds its shape.",
    usedFor: ["soft-materials research", "teaching polymer networks", "designing gels for products and biomedical research"],
  },
  "mix-vanishing-film": {
    whatItIs: "This quest models a thin PVA-based film that dissolves in water.",
    whatItDoes: "Water separates the polymer chains enough for the film to disperse; the simulation also estimates whether its ingredients are biodegradable.",
    whyItMatters: "Dissolving and biodegrading are different properties, and neither alone proves that a material is harmless in the environment.",
    usedFor: ["water-soluble packaging", "detergent pods", "studying biodegradable polymer films"],
  },
  "mix-sticky-situation": {
    whatItIs: "This quest models an adhesive mixture inspired by mussel foot proteins.",
    whatItDoes: "Catechol-containing groups can help proteins attach to surfaces and form a connected material.",
    whyItMatters: "Adhesion depends on both the chemistry at a surface and the strength of the material holding the surfaces together.",
    usedFor: ["wet-adhesive research", "medical materials research", "understanding how mussels attach to rocks"],
  },
  "mix-strand": {
    whatItIs: "This quest models a fiber based on silk proteins and a small amount of plasticizer.",
    whatItDoes: "The simulated fiber has separate estimates for tensile strength and elongation, so it can be strong without being very stretchy—or vice versa.",
    whyItMatters: "Real fibers balance strength, stretch, toughness, and processing; a model result is a hypothesis, not a measured material.",
    usedFor: ["textile engineering", "biomaterials research", "designing lightweight structural fibers"],
  },
  "mix-enzyme-helper": {
    whatItIs: "This quest combines a protein material with an enzyme under selected temperature and pH conditions.",
    whatItDoes: "Enzymes speed up specific reactions, and the model checks whether the chosen enzyme is active in the simulated environment.",
    whyItMatters: "An enzyme's activity depends on its surroundings, so matching pH and temperature can matter as much as choosing the molecule.",
    usedFor: ["food processing", "biotechnology", "studying protein chemistry"],
  },
  "atom-split": {
    whatItIs: "This quest explores a neutron-triggered fission event in a heavy nucleus.",
    whatItDoes: "In the model, a neutron hit can make the nucleus split into smaller nuclei and release energy.",
    whyItMatters: "Fission explains how nuclear power plants produce heat and how some medical isotopes are made; the app's estimates are educational, not reactor-design data.",
    usedFor: ["electricity generation in nuclear power plants", "production of some medical isotopes", "learning about nuclear binding energy"],
  },
  "atom-tightest": {
    whatItIs: "This quest compares how strongly nucleons are held together, measured as binding energy per nucleon.",
    whatItDoes: "The model's liquid-drop calculation places its peak near iron and nickel, where each nucleon is especially tightly bound.",
    whyItMatters: "Binding energy helps explain why fusion of light nuclei and fission of very heavy nuclei can release energy.",
    usedFor: ["understanding stellar energy", "learning why nuclear reactions release energy", "comparing isotope stability"],
  },
  "atom-alpha": {
    whatItIs: "This quest follows alpha decay, in which a nucleus emits a compact group of two protons and two neutrons.",
    whatItDoes: "The decay-chain model updates the nucleus after each predicted emission and stops when it reaches a stable result or its step limit.",
    whyItMatters: "Radioactive decay changes one element into another and is used to understand geology, radiation, and the history of matter.",
    usedFor: ["radiometric dating", "nuclear physics education", "understanding naturally occurring radioactivity"],
  },
  "atom-new-element": {
    whatItIs: "This quest explores a hypothetical nucleus with more protons than any confirmed element.",
    whatItDoes: "The model estimates whether the nucleus is bound and how long it might last, but a model nucleus is a prediction, not a real element.",
    whyItMatters: "Real new elements are made a few atoms at a time in particle accelerators and must be detected through their decay; calculations alone do not discover an element.",
    usedFor: ["research on the limits of the periodic table", "nuclear-structure calculations", "learning how particle-accelerator discoveries are confirmed"],
  },
};

function cardContext(title: string, sections: LearnSection[], usedFor: string[]) {
  return [
    title,
    ...sections.map((section) => `${section.heading}: ${section.body}`),
    `Used for:\n${usedFor.map((use) => `- ${use}`).join("\n")}`,
  ].join("\n\n");
}

function createCard(
  title: string,
  sections: LearnSection[],
  usedFor: string[],
  askPrompt: string,
): LearnCard {
  return {
    title,
    sections,
    usedFor,
    askPrompt,
    context: cardContext(title, sections, usedFor),
  };
}

export function moleculeCard(molecule: KnownMolecule): LearnCard {
  const lesson = MOLECULE_LESSONS[molecule.id];
  const sections = [
    { heading: "What it is", body: lesson.whatItIs },
    { heading: "Why it's shaped like this", body: lesson.whyShape },
    { heading: "What it does", body: lesson.whatItDoes },
    {
      heading: "Why it matters",
      body: lesson.whyItMatters + (molecule.caution ? ` Safety note: ${molecule.caution}` : ""),
    },
  ];
  return createCard(
    `${molecule.name} (${prettyFormula(molecule.formula)})`,
    sections,
    lesson.usedFor,
    `How do ${molecule.name}'s bonds and shape help explain what it does and where it is used?`,
  );
}

function mixRunDetails(result: RunResult): string {
  const events = result.events
    .filter((event) => event.status === "happened" || event.status === "partial")
    .map((event) => `${event.name} (${event.status}): ${event.mechanism}`);
  const lines = [
    `${result.productLabel}: ${result.summary}`,
    ...(events.length ? events : ["No reaction events happened or were partial in this run."]),
    `Effective pH: ${result.effectivePH.toFixed(1)}.`,
    result.setSeconds > 0
      ? `Set time: ${fmtTime(result.setSeconds)}.`
      : "It doesn't set on its own.",
  ];
  if (result.tensileMPa !== 0) lines.push(`Strength: ${result.tensileMPa.toFixed(1)} MPa tensile strength.`);
  if (result.elongationPct !== 0) lines.push(`Stretch: ${result.elongationPct.toFixed(1)}% elongation.`);
  if (result.tack !== 0) lines.push(`Stickiness: ${result.tack.toFixed(1)}/10 tack.`);
  lines.push(
    `Safety: wet toxicity ${hazardWord(result.wetToxicity)}; cured toxicity ${hazardWord(result.curedToxicity)}; skin hazard ${hazardWord(result.skin)}.`,
  );
  return lines.join("\n");
}

export function mixCard(
  quest: MixQuest,
  experiment: Experiment,
  result: RunResult,
): LearnCard {
  const lesson = QUEST_LESSONS[quest.id];
  const ingredients = experiment.parts
    .filter((part) => part.pct > 0)
    .map((part) => `${benchById[part.id]?.name ?? part.id} ${part.pct.toFixed(1)}%`)
    .join(", ");
  const sections = [
    {
      heading: "What it is",
      body: `${lesson.whatItIs}\nIngredients in this run: ${ingredients || "none listed"}.`,
    },
    { heading: "What happened in your run", body: mixRunDetails(result) },
    { heading: "What it does", body: lesson.whatItDoes },
    { heading: "Why it matters", body: lesson.whyItMatters },
  ];
  return createCard(
    quest.title,
    sections,
    lesson.usedFor,
    `Why did this run produce ${result.productLabel.toLowerCase()}, and what change would most affect its result?`,
  );
}

function nucleusRunDetails(
  quest: AtomQuest,
  z: number,
  n: number,
): string {
  if (!Number.isInteger(z) || !Number.isFinite(z) || z <= 0 ||
      !Number.isInteger(n) || !Number.isFinite(n) || n < 0) {
    return "The nucleus model needs a whole-number proton count above zero and a nonnegative whole-number neutron count.";
  }
  try {
    const report = analyzeNucleus(z, n);
    const lines = [
      `${report.name} (${report.symbol}), Z=${z}, N=${n}, A=${report.a}: ${report.verdict}`,
      `Estimated half-life: ${report.halfLife}.`,
      `Binding energy per nucleon: ${report.perNucleonMeV.toFixed(2)} MeV.`,
      `Modelled decay modes: ${report.modes.join("; ") || "none listed"}.`,
    ];
    if (quest.id === "atom-split") {
      const hit = neutronHit(z, n);
      lines.push(`Neutron hit (${hit.kind}): ${hit.caption}`);
      lines.push(`Estimated energy from this event: ${hit.energyMeV.toFixed(2)} MeV.`);
    } else {
      const firstStep = decayChain(z, n, 1)[0];
      if (firstStep) lines.push(`First decay step: ${firstStep.caption}`);
    }
    lines.push("These values are rough liquid-drop model estimates, not measurements.");
    return lines.join("\n");
  } catch {
    return "The nucleus model could not calculate this input; check the proton and neutron counts.";
  }
}

export function atomCard(
  quest: AtomQuest,
  z: number,
  n: number,
): LearnCard {
  const lesson = QUEST_LESSONS[quest.id];
  const sections = [
    { heading: "What it is", body: lesson.whatItIs },
    { heading: "What happened in your run", body: nucleusRunDetails(quest, z, n) },
    { heading: "What it does", body: lesson.whatItDoes },
    { heading: "Why it matters", body: lesson.whyItMatters },
  ];
  return createCard(
    quest.title,
    sections,
    lesson.usedFor,
    `What does the model's result for ${z} protons and ${n} neutrons tell us, and what are its limits?`,
  );
}
