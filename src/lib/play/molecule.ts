import { ATOMS, type AtomSymbol } from "./atoms";

export type BondOrder = 1 | 2 | 3;

export interface MolAtom {
  id: string;
  el: AtomSymbol;
  x: number;
  y: number;
}

export interface MolBond {
  a: string;
  b: string;
  order: BondOrder;
}

export interface MolGraph {
  atoms: MolAtom[];
  bonds: MolBond[];
}

export const EMPTY_GRAPH: MolGraph = { atoms: [], bonds: [] };

export function addAtom(g: MolGraph, el: AtomSymbol, x: number, y: number): MolGraph {
  const maxId = g.atoms.reduce((maximum, atom) => {
    const match = /^a(\d+)$/.exec(atom.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return {
    atoms: [...g.atoms, { id: `a${maxId + 1}`, el, x, y }],
    bonds: [...g.bonds],
  };
}

export function removeAtom(g: MolGraph, id: string): MolGraph {
  return {
    atoms: g.atoms.filter((atom) => atom.id !== id),
    bonds: g.bonds.filter((bond) => bond.a !== id && bond.b !== id),
  };
}

export function moveAtom(g: MolGraph, id: string, x: number, y: number): MolGraph {
  return {
    atoms: g.atoms.map((atom) => atom.id === id ? { ...atom, x, y } : atom),
    bonds: [...g.bonds],
  };
}

export function bondBetween(g: MolGraph, a: string, b: string): MolBond | undefined {
  return g.bonds.find(
    (bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a),
  );
}

export function bondsUsed(g: MolGraph, id: string): number {
  return g.bonds.reduce((total, bond) => {
    return bond.a === id || bond.b === id ? total + bond.order : total;
  }, 0);
}

export function freeValence(g: MolGraph, id: string): number {
  const atom = g.atoms.find((item) => item.id === id);
  return atom ? Math.max(0, ATOMS[atom.el].valence - bondsUsed(g, id)) : 0;
}

function atomCanTake(g: MolGraph, id: string, addedOrder: number): boolean {
  return freeValence(g, id) >= addedOrder;
}

export function cycleBond(g: MolGraph, a: string, b: string): MolGraph {
  if (a === b) return g;
  const existing = bondBetween(g, a, b);
  if (!existing) {
    if (!atomCanTake(g, a, 1) || !atomCanTake(g, b, 1)) return g;
    return { atoms: [...g.atoms], bonds: [...g.bonds, { a, b, order: 1 }] };
  }

  if (existing.order === 3) {
    return {
      atoms: [...g.atoms],
      bonds: g.bonds.filter((bond) => bond !== existing),
    };
  }

  const nextOrder = (existing.order + 1) as BondOrder;
  if (atomCanTake(g, a, 1) && atomCanTake(g, b, 1)) {
    return {
      atoms: [...g.atoms],
      bonds: g.bonds.map((bond) =>
        bond === existing ? { ...bond, order: nextOrder } : bond,
      ),
    };
  }

  if (existing.order === 1) {
    return {
      atoms: [...g.atoms],
      bonds: g.bonds.filter((bond) => bond !== existing),
    };
  }
  return g;
}

export function formula(g: MolGraph): string {
  const counts = new Map<AtomSymbol, number>();
  for (const atom of g.atoms) counts.set(atom.el, (counts.get(atom.el) ?? 0) + 1);
  const symbols = [...counts.keys()];
  const order = symbols.includes("C")
    ? [
        "C",
        ...(symbols.includes("H") ? ["H"] : []),
        ...symbols.filter((symbol) => symbol !== "C" && symbol !== "H").sort(),
      ]
    : symbols.sort();
  return order
    .map((symbol) => `${symbol}${(counts.get(symbol as AtomSymbol) ?? 0) > 1 ? counts.get(symbol as AtomSymbol) : ""}`)
    .join("");
}

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

export function prettyFormula(value: string): string {
  return value.replace(/\d/g, (digit) => SUBSCRIPTS[digit]);
}

export function moleculeSignature(g: MolGraph): string {
  const environments = g.atoms.map((atom) => {
    const neighbors = g.bonds.flatMap((bond) => {
      if (bond.a === atom.id) {
        const other = g.atoms.find((item) => item.id === bond.b);
        return other ? [`${other.el}${bond.order}`] : [];
      }
      if (bond.b === atom.id) {
        const other = g.atoms.find((item) => item.id === bond.a);
        return other ? [`${other.el}${bond.order}`] : [];
      }
      return [];
    });
    neighbors.sort();
    return `${atom.el}[${neighbors.join(",")}]`;
  });
  environments.sort();
  return `${formula(g)}|${environments.join(";")}`;
}

export interface KnownMolecule {
  id: string;
  name: string;
  formula: string;
  shape: string;
  angle?: string;
  uses: string;
  fact: string;
  caution?: string;
  graph: MolGraph;
}

type AtomPoint = readonly [AtomSymbol, number, number];
type BondSpec = readonly [number, number, BondOrder];

function graphFor(atoms: AtomPoint[], bonds: BondSpec[]): MolGraph {
  return {
    atoms: atoms.map(([el, x, y], index) => ({ id: `a${index + 1}`, el, x, y })),
    bonds: bonds.map(([a, b, order]) => ({
      a: `a${a + 1}`,
      b: `a${b + 1}`,
      order,
    })),
  };
}

function known(
  id: string,
  name: string,
  shape: string,
  uses: string,
  fact: string,
  atoms: AtomPoint[],
  bonds: BondSpec[],
  details: { angle?: string; caution?: string } = {},
): KnownMolecule {
  const graph = graphFor(atoms, bonds);
  return { id, name, formula: formula(graph), shape, uses, fact, graph, ...details };
}

export const KNOWN_MOLECULES: KnownMolecule[] = [
  known("hydrogen", "Hydrogen", "linear", "Hydrogen gas is used in fuel cells and some industrial processes.", "A hydrogen molecule shares one pair of electrons between two H atoms.", [["H", -35, 0], ["H", 35, 0]], [[0, 1, 1]], { caution: "Hydrogen gas catches fire very easily." }),
  known("oxygen", "Oxygen", "linear", "Oxygen is essential for respiration and supports combustion.", "The two oxygen atoms in O₂ share two pairs of electrons.", [["O", -35, 0], ["O", 35, 0]], [[0, 1, 2]]),
  known("nitrogen", "Nitrogen", "linear", "Nitrogen makes up most of Earth's atmosphere.", "The strong triple bond makes nitrogen gas relatively unreactive.", [["N", -35, 0], ["N", 35, 0]], [[0, 1, 3]]),
  known("water", "Water", "bent", "Water is a solvent for many substances and is essential to life.", "The two lone pairs on oxygen help give water its bent shape.", [["O", 0, 0], ["H", -55, 43], ["H", 55, 43]], [[0, 1, 1], [0, 2, 1]], { angle: "104.5°" }),
  known("carbon-dioxide", "Carbon dioxide", "linear", "Plants use carbon dioxide during photosynthesis.", "Each C=O double bond shares two electron pairs.", [["C", 0, 0], ["O", -70, 0], ["O", 70, 0]], [[0, 1, 2], [0, 2, 2]], { angle: "180°" }),
  known("methane", "Methane", "tetrahedral", "Methane is the main component of natural gas used as fuel.", "Four C–H bonds point toward the corners of a tetrahedron.", [["C", 0, 0], ["H", -50, -50], ["H", 50, -50], ["H", -50, 50], ["H", 50, 50]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], { angle: "109.5°", caution: "Methane is highly flammable and can displace oxygen in a closed space." }),
  known("ammonia", "Ammonia", "trigonal pyramidal", "Ammonia is used in fertilizers and household cleaners.", "Nitrogen's lone pair pushes the three N–H bonds into a pyramid shape.", [["N", 0, 0], ["H", 0, -70], ["H", -61, 35], ["H", 61, 35]], [[0, 1, 1], [0, 2, 1], [0, 3, 1]], { angle: "107°" }),
  known("hydrogen-chloride", "Hydrogen chloride", "linear", "Hydrogen chloride is used in controlled industrial chemistry.", "Hydrogen chloride dissolves in water to form hydrochloric acid.", [["H", -35, 0], ["Cl", 35, 0]], [[0, 1, 1]], { caution: "Hydrogen chloride gas is corrosive and can seriously injure the lungs." }),
  known("hydrogen-peroxide", "Hydrogen peroxide", "non-planar", "Dilute hydrogen peroxide is used in some disinfecting and bleaching products.", "The two oxygen atoms are joined by a single bond, and the molecule is not flat.", [["O", -35, 0], ["O", 35, 0], ["H", -47, 69], ["H", 47, 69]], [[0, 1, 1], [0, 2, 1], [1, 3, 1]], { angle: "~100° at oxygen", caution: "Concentrated hydrogen peroxide can burn skin and decompose dangerously." }),
  known("hydrogen-cyanide", "Hydrogen cyanide", "linear", "Hydrogen cyanide is a chemical feedstock handled only in specialized facilities.", "Its carbon and nitrogen atoms are joined by a triple bond.", [["H", -70, 0], ["C", 0, 0], ["N", 70, 0]], [[0, 1, 1], [1, 2, 3]], { angle: "180°", caution: "Hydrogen cyanide is acutely poisonous and can be fatal in tiny amounts." }),
  known("ethane", "Ethane", "tetrahedral", "Ethane is a fuel and an industrial chemical feedstock.", "The two carbon atoms share a single bond and each has three hydrogens.", [["C", -35, 0], ["C", 35, 0], ["H", -105, 0], ["H", -70, -60], ["H", -70, 60], ["H", 105, 0], ["H", 70, -60], ["H", 70, 60]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1]], { angle: "about 109.5° around each carbon", caution: "Ethane is highly flammable." }),
  known("ethylene", "Ethylene", "trigonal planar", "Ethylene helps some fruit ripen and is used to make common plastics.", "The C=C double bond keeps each carbon mostly in a flat, three-bond arrangement.", [["C", -35, 0], ["C", 35, 0], ["H", -70, -60], ["H", -70, 60], ["H", 70, -60], ["H", 70, 60]], [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]], { angle: "about 120°", caution: "Ethylene is a flammable gas." }),
  known("acetylene", "Acetylene", "linear", "Acetylene is used as a fuel gas in specialized welding equipment.", "The carbon atoms share three electron pairs in a straight line.", [["H", -105, 0], ["C", -35, 0], ["C", 35, 0], ["H", 105, 0]], [[0, 1, 1], [1, 2, 3], [2, 3, 1]], { angle: "180°", caution: "Acetylene is extremely flammable and can form explosive mixtures." }),
  known("methanol", "Methanol", "tetrahedral around carbon", "Methanol is used as an industrial solvent and fuel.", "Methanol is the simplest alcohol, with one carbon bonded to oxygen.", [["C", -35, 0], ["O", 35, 0], ["H", -105, 0], ["H", -70, -60], ["H", -70, 60], ["H", 70, 60]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1]], { angle: "about 109.5° at carbon", caution: "Methanol is poisonous if swallowed or absorbed in significant amounts." }),
  known("ethanol", "Ethanol", "tetrahedral around carbon", "Ethanol is the alcohol found in beverages and is also used as a solvent.", "Ethanol has a two-carbon chain and an –OH group.", [["C", -70, 0], ["C", 0, 0], ["O", 70, 0], ["H", -140, 0], ["H", -105, -60], ["H", -105, 60], ["H", 0, -70], ["H", 0, 70], ["H", 105, 60]], [[0, 1, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [1, 2, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1]], { angle: "about 109.5° at carbon", caution: "Ethanol is flammable; drinking it can harm health." }),
  known("dimethyl-ether", "Dimethyl ether", "bent", "Dimethyl ether is used as a propellant and a fuel.", "Its oxygen sits between two carbons, unlike ethanol's terminal –OH group.", [["O", 0, 0], ["C", -58, 39], ["C", 58, 39], ["H", -100, 95], ["H", -130, 39], ["H", -100, -17], ["H", 100, 95], ["H", 130, 39], ["H", 100, -17]], [[0, 1, 1], [0, 2, 1], [1, 3, 1], [1, 4, 1], [1, 5, 1], [2, 6, 1], [2, 7, 1], [2, 8, 1]], { angle: "~111° at oxygen", caution: "Dimethyl ether is a highly flammable gas." }),
  known("formaldehyde", "Formaldehyde", "trigonal planar", "Formaldehyde is used to make resins and other industrial materials.", "Formaldehyde has a carbonyl C=O double bond.", [["C", 0, 0], ["O", 70, 0], ["H", -35, -60], ["H", -35, 60]], [[0, 1, 2], [0, 2, 1], [0, 3, 1]], { angle: "about 120°", caution: "Formaldehyde is toxic and can cause cancer." }),
  known("formic-acid", "Formic acid", "trigonal planar at carbon", "Some ants use formic acid as a defense, and it also has industrial uses.", "Formic acid is the simplest carboxylic acid.", [["C", 0, 0], ["O", 70, 0], ["O", -35, 60], ["H", -35, -60], ["H", -105, 60]], [[0, 1, 2], [0, 2, 1], [0, 3, 1], [2, 4, 1]], { angle: "about 120° at carbon", caution: "Concentrated formic acid is corrosive and harmful to skin." }),
  known("acetic-acid", "Acetic acid", "trigonal planar at carbon", "Acetic acid gives vinegar its familiar sour taste.", "Acetic acid is a two-carbon carboxylic acid.", [["C", -70, 0], ["C", 0, 0], ["O", 70, 0], ["O", -35, 60], ["H", -140, 0], ["H", -105, -60], ["H", -105, 60], ["H", -105, 120]], [[0, 1, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1], [1, 2, 2], [1, 3, 1], [3, 7, 1]], { angle: "about 120° at carbonyl carbon" }),
  known("hydrogen-sulfide", "Hydrogen sulfide", "bent", "Hydrogen sulfide can form during the breakdown of organic matter.", "Hydrogen sulfide has a bent shape and is known for a rotten-egg odor.", [["S", 0, 0], ["H", -50, 49], ["H", 50, 49]], [[0, 1, 1], [0, 2, 1]], { angle: "92°", caution: "Hydrogen sulfide is highly toxic and can quickly overwhelm the sense of smell." }),
  known("phosphine", "Phosphine", "trigonal pyramidal", "Phosphine is used in specialized semiconductor and research settings.", "Phosphine has three P–H bonds arranged in a shallow pyramid.", [["P", 0, 0], ["H", 0, -70], ["H", -61, 35], ["H", 61, 35]], [[0, 1, 1], [0, 2, 1], [0, 3, 1]], { angle: "about 93.5°", caution: "Phosphine is extremely toxic and flammable." }),
  known("hydrogen-fluoride", "Hydrogen fluoride", "linear", "Hydrogen fluoride is used in tightly controlled industrial processes.", "In water, hydrogen fluoride is called hydrofluoric acid.", [["H", -35, 0], ["F", 35, 0]], [[0, 1, 1]], { caution: "Hydrogen fluoride is highly corrosive and can cause deep, dangerous burns." }),
  known("carbon-tetrachloride", "Carbon tetrachloride", "tetrahedral", "Carbon tetrachloride was used as a solvent, but most uses were phased out.", "Four C–Cl bonds point toward the corners of a tetrahedron.", [["C", 0, 0], ["Cl", -50, -50], ["Cl", 50, -50], ["Cl", -50, 50], ["Cl", 50, 50]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], { angle: "109.5°", caution: "Carbon tetrachloride is toxic and harms the ozone layer." }),
  known("chloroform", "Chloroform", "tetrahedral", "Chloroform was once used as an anesthetic and is now mainly a laboratory solvent.", "Chloroform has one H and three Cl atoms bonded to a central carbon.", [["C", 0, 0], ["H", 50, 50], ["Cl", -50, -50], ["Cl", 50, -50], ["Cl", -50, 50]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], { angle: "109.5°", caution: "Chloroform is toxic and should not be inhaled or swallowed." }),
];

const knownBySignature = new Map(
  KNOWN_MOLECULES.map((molecule) => [moleculeSignature(molecule.graph), molecule]),
);

export function identify(g: MolGraph): KnownMolecule | undefined {
  return knownBySignature.get(moleculeSignature(g));
}

export interface MolCheck {
  atomCount: number;
  connected: boolean;
  complete: boolean;
  openValences: { atomId: string; el: AtomSymbol; missing: number }[];
  formula: string;
  match?: KnownMolecule;
  problems: string[];
}

function graphIsConnected(g: MolGraph): boolean {
  if (g.atoms.length === 0) return false;
  const visited = new Set<string>();
  const pending = [g.atoms[0].id];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const bond of g.bonds) {
      const neighbor = bond.a === id ? bond.b : bond.b === id ? bond.a : undefined;
      if (neighbor && !visited.has(neighbor)) pending.push(neighbor);
    }
  }
  return visited.size === g.atoms.length;
}

export function checkMolecule(g: MolGraph): MolCheck {
  const openValences = g.atoms.flatMap((atom) => {
    const missing = freeValence(g, atom.id);
    return missing > 0 ? [{ atomId: atom.id, el: atom.el, missing }] : [];
  });
  const connected = graphIsConnected(g);
  const complete =
    g.atoms.length >= 2 &&
    connected &&
    openValences.length === 0;
  const problems: string[] = [];

  if (g.atoms.length < 2) problems.push("Add at least two atoms");
  if (g.atoms.length >= 2 && !connected) {
    problems.push("Some atoms aren't connected to the rest");
  }
  const grouped = new Map<string, { el: AtomSymbol; missing: number; count: number }>();
  for (const open of openValences) {
    const key = `${open.el}:${open.missing}`;
    const group = grouped.get(key);
    if (group) group.count += 1;
    else grouped.set(key, { el: open.el, missing: open.missing, count: 1 });
  }
  for (const { el, missing, count } of grouped.values()) {
    const subject = count === 1 ? el : `${count} ${el} atoms`;
    const verb = count === 1 ? "still wants" : "still want";
    problems.push(`${subject} ${verb} ${missing} more bond${missing === 1 ? "" : "s"}`);
  }

  return {
    atomCount: g.atoms.length,
    connected,
    complete,
    openValences,
    formula: formula(g),
    match: identify(g),
    problems,
  };
}
