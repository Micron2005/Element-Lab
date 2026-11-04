import { GLOSSARY_ES } from "./i18n/data/es/glossary";

export interface GlossaryEntry {
  term: string;
  plain: string;
  example?: string;
}

export const GLOSSARY = {
  mpa: {
    term: "MPa",
    plain: "A megapascal is a unit for pressure or strength. One MPa equals one million pascals.",
    example: "A material rated at 5 MPa can resist more pulling stress than one rated at 2 MPa.",
  },
  "tensile-strength": {
    term: "Tensile strength",
    plain: "How much pulling stress a material can take before it breaks.",
  },
  stretch: {
    term: "Stretch",
    plain: "How much longer a material gets when pulled before it breaks, shown as a percent.",
  },
  toughness: {
    term: "Toughness",
    plain: "How much energy a material can absorb before it breaks.",
  },
  tack: {
    term: "Tack",
    plain: "How sticky a material feels when it first touches another surface.",
  },
  "set-time": {
    term: "Set time",
    plain: "How long a mixture takes to become firm enough to hold its shape.",
  },
  viscosity: {
    term: "Viscosity",
    plain: "How much a liquid resists flowing. Honey has higher viscosity than water.",
  },
  density: {
    term: "Density",
    plain: "How much mass fits in a certain amount of space.",
  },
  "surface-tension": {
    term: "Surface tension",
    plain: "A liquid’s surface pulls together, like a thin stretchy skin.",
  },
  ph: {
    term: "pH",
    plain: "A scale that describes how acidic or basic a water-based liquid is.",
  },
  acid: {
    term: "Acid",
    plain: "A substance that can give away hydrogen ions in a reaction.",
  },
  base: {
    term: "Base",
    plain: "A substance that can take in hydrogen ions in a reaction.",
  },
  buffer: {
    term: "Buffer",
    plain: "A mixture that helps keep pH from changing quickly.",
  },
  pka: {
    term: "pKa",
    plain: "A number that describes how easily an acid gives up a hydrogen ion. A lower pKa usually means a stronger acid.",
  },
  polymer: {
    term: "Polymer",
    plain: "A large molecule made from many smaller repeating parts.",
  },
  crosslink: {
    term: "Crosslink",
    plain: "A connection that joins one polymer chain to another.",
  },
  plasticizer: {
    term: "Plasticizer",
    plain: "An ingredient that can make a polymer softer or easier to bend.",
  },
  solvent: {
    term: "Solvent",
    plain: "A liquid that can dissolve another substance.",
  },
  filler: {
    term: "Filler",
    plain: "An added material that changes a mixture’s cost or physical properties.",
  },
  enzyme: {
    term: "Enzyme",
    plain: "A molecule, often a protein, that helps a chemical reaction happen faster.",
  },
  protein: {
    term: "Protein",
    plain: "A large molecule built from amino acids that has jobs in living things.",
  },
  hydrogel: {
    term: "Hydrogel",
    plain: "A soft network of material that holds a large amount of water.",
  },
  toxicity: {
    term: "Toxicity",
    plain: "The ability of a substance to harm living things.",
  },
  confidence: {
    term: "Confidence",
    plain: "How strongly the model’s rules and data support an estimate. It is not a guarantee.",
  },
  proton: {
    term: "Proton",
    plain: "A positively charged particle in an atom’s nucleus.",
  },
  neutron: {
    term: "Neutron",
    plain: "A particle with no electric charge in an atom’s nucleus.",
  },
  nucleon: {
    term: "Nucleon",
    plain: "A proton or neutron in an atomic nucleus.",
  },
  isotope: {
    term: "Isotope",
    plain: "Atoms of the same element with different numbers of neutrons are different isotopes.",
  },
  "mass-number": {
    term: "Mass number",
    plain: "The total number of protons and neutrons in a nucleus.",
  },
  "binding-energy": {
    term: "Binding energy",
    plain: "Energy needed to pull the particles in a nucleus completely apart.",
  },
  mev: {
    term: "MeV",
    plain: "A mega electron volt, a unit used to measure the energy of tiny particles.",
  },
  fissility: {
    term: "Fissility",
    plain: "A model measure of how easily a nucleus may split apart.",
  },
  "half-life": {
    term: "Half-life",
    plain: "The time it takes for half the atoms in a radioactive sample to decay.",
  },
  "alpha-decay": {
    term: "Alpha decay",
    plain: "A type of decay where a nucleus sends out two protons and two neutrons.",
  },
  "beta-decay": {
    term: "Beta decay",
    plain: "A type of decay that changes a neutron into a proton, or a proton into a neutron, and emits other particles.",
  },
  fission: {
    term: "Fission",
    plain: "When a heavy atomic nucleus splits into smaller nuclei.",
  },
  fusion: {
    term: "Fusion",
    plain: "When two light atomic nuclei join to make a heavier nucleus.",
  },
  "coulomb-barrier": {
    term: "Coulomb barrier",
    plain: "The electric push that makes two positively charged nuclei resist coming close together.",
  },
  "cross-section": {
    term: "Cross section",
    plain: "A measure of how likely a particle is to take part in a nuclear reaction.",
  },
  "magic-numbers": {
    term: "Magic numbers",
    plain: "Counts of protons or neutrons that can make a nucleus especially stable.",
  },
  molecule: {
    term: "Molecule",
    plain: "A group of atoms held together by chemical bonds.",
  },
  bond: {
    term: "Bond",
    plain: "A force that holds atoms together in a molecule.",
  },
  "double-bond": {
    term: "Double bond",
    plain: "A bond where two atoms share two pairs of electrons.",
  },
  "lone-pair": {
    term: "Lone pair",
    plain: "A pair of outer electrons that is not shared in a bond.",
  },
  valence: {
    term: "Valence",
    plain: "How an atom can join with other atoms, based on its outer electrons.",
  },
  "bond-angle": {
    term: "Bond angle",
    plain: "The angle between two bonds that meet at the same atom.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type TermId = keyof typeof GLOSSARY;

export function glossaryFor(locale: "en" | "es"): Record<TermId, GlossaryEntry> {
  return locale === "es" ? GLOSSARY_ES : GLOSSARY;
}

export const GLOSSARY_GROUPS = {
  Bench: [
    "mpa",
    "tensile-strength",
    "stretch",
    "toughness",
    "tack",
    "set-time",
    "viscosity",
    "density",
    "surface-tension",
    "ph",
    "acid",
    "base",
    "buffer",
    "pka",
    "polymer",
    "crosslink",
    "plasticizer",
    "solvent",
    "filler",
    "enzyme",
    "protein",
    "hydrogel",
    "toxicity",
    "confidence",
  ],
  Elements: [
    "proton",
    "neutron",
    "nucleon",
    "isotope",
    "mass-number",
    "binding-energy",
    "mev",
    "fissility",
    "half-life",
    "alpha-decay",
    "beta-decay",
    "fission",
    "fusion",
    "coulomb-barrier",
    "cross-section",
    "magic-numbers",
  ],
  Play: ["molecule", "bond", "double-bond", "lone-pair", "valence", "bond-angle"],
} as const satisfies Record<string, readonly TermId[]>;
