import { describe, expect, it } from "vitest";
import { ATOMS } from "./atoms";
import {
  EMPTY_GRAPH,
  KNOWN_MOLECULES,
  addAtom,
  bondBetween,
  bondsUsed,
  checkMolecule,
  cycleBond,
  formula,
  freeValence,
  identify,
  moleculeSignature,
  moveAtom,
  prettyFormula,
  removeAtom,
} from "./molecule";

function atoms(...elements: ("H" | "C" | "N" | "O")[]) {
  return elements.reduce((graph, element, index) => addAtom(graph, element, index * 70, 0), EMPTY_GRAPH);
}

describe("immutable molecule graphs", () => {
  it("uses unique atom ids from the maximum numeric suffix and leaves inputs unchanged", () => {
    const first = addAtom(EMPTY_GRAPH, "C", 0, 0);
    const second = addAtom(first, "H", 70, 0);
    const third = addAtom(second, "O", 140, 0);
    const withoutSecond = removeAtom(third, "a2");
    const fourth = addAtom(withoutSecond, "N", 210, 0);

    expect(first.atoms).toHaveLength(1);
    expect(third.atoms.map((atom) => atom.id)).toEqual(["a1", "a2", "a3"]);
    expect(fourth.atoms.map((atom) => atom.id)).toEqual(["a1", "a3", "a4"]);
    expect(removeAtom(third, "a2").bonds).toEqual([]);
    expect(moveAtom(third, "a1", 5, 6).atoms[0]).toEqual({ id: "a1", el: "C", x: 5, y: 6 });
    expect(third.atoms[0]).toEqual({ id: "a1", el: "C", x: 0, y: 0 });
  });

  it("cycles H–H from single to none and limits O=O to a double bond", () => {
    const h = atoms("H", "H");
    const hSingle = cycleBond(h, "a1", "a2");
    expect(bondBetween(hSingle, "a1", "a2")?.order).toBe(1);
    expect(cycleBond(hSingle, "a1", "a2").bonds).toHaveLength(0);

    const o = atoms("O", "O");
    const oSingle = cycleBond(o, "a1", "a2");
    const oDouble = cycleBond(oSingle, "a1", "a2");
    expect(bondBetween(oDouble, "a1", "a2")?.order).toBe(2);
    expect(cycleBond(oDouble, "a1", "a2")).toEqual(oDouble);
    expect(bondsUsed(oDouble, "a1")).toBe(ATOMS.O.valence);
  });

  it("cycles C≡C back to none, never raises C–H above single, and ignores self-bonds", () => {
    let carbonPair = atoms("C", "C");
    carbonPair = cycleBond(carbonPair, "a1", "a2");
    carbonPair = cycleBond(carbonPair, "a1", "a2");
    carbonPair = cycleBond(carbonPair, "a1", "a2");
    expect(bondBetween(carbonPair, "a1", "a2")?.order).toBe(3);
    expect(cycleBond(carbonPair, "a1", "a2").bonds).toHaveLength(0);

    const carbonHydrogen = atoms("C", "H");
    const single = cycleBond(carbonHydrogen, "a1", "a2");
    expect(cycleBond(single, "a1", "a2").bonds).toHaveLength(0);
    expect(cycleBond(carbonHydrogen, "a1", "a1")).toBe(carbonHydrogen);
    expect(freeValence(single, "a2")).toBe(0);
    expect(cycleBond(single, "a1", "a3")).toEqual(single);
  });

  it("formats molecular formulas in Hill order and converts counts to subscripts", () => {
    expect(formula(KNOWN_MOLECULES.find((molecule) => molecule.id === "water")!.graph)).toBe("H2O");
    expect(formula(KNOWN_MOLECULES.find((molecule) => molecule.id === "carbon-dioxide")!.graph)).toBe("CO2");
    expect(formula(KNOWN_MOLECULES.find((molecule) => molecule.id === "ethanol")!.graph)).toBe("C2H6O");
    expect(formula(KNOWN_MOLECULES.find((molecule) => molecule.id === "hydrogen-chloride")!.graph)).toBe("ClH");
    expect(prettyFormula("C2H6O")).toBe("C₂H₆O");
  });

  it("uses connectivity as well as formula to distinguish structural isomers", () => {
    const ethanol = KNOWN_MOLECULES.find((molecule) => molecule.id === "ethanol")!;
    const ether = KNOWN_MOLECULES.find((molecule) => molecule.id === "dimethyl-ether")!;
    expect(ethanol.formula).toBe(ether.formula);
    expect(moleculeSignature(ethanol.graph)).not.toBe(moleculeSignature(ether.graph));
    expect(identify(ethanol.graph)?.id).toBe("ethanol");
    expect(identify(ether.graph)?.id).toBe("dimethyl-ether");
  });

  it("lays out every known molecule as a complete, identifiable reference graph", () => {
    expect(KNOWN_MOLECULES).toHaveLength(24);
    for (const molecule of KNOWN_MOLECULES) {
      const result = checkMolecule(molecule.graph);
      expect(result.complete, molecule.name).toBe(true);
      expect(result.match?.id, molecule.name).toBe(molecule.id);
      expect(molecule.formula, molecule.name).toBe(result.formula);
      expect(molecule.uses.endsWith(".")).toBe(true);
      expect(molecule.fact.endsWith(".")).toBe(true);
    }
  });

  it("reports grouped open valences and disconnected atoms in plain language", () => {
    const hO = cycleBond(atoms("H", "O"), "a1", "a2");
    const partial = checkMolecule(hO);
    expect(partial.complete).toBe(false);
    expect(partial.problems).toContain("O still wants 1 more bond");

    const disconnected = checkMolecule(atoms("H", "H"));
    expect(disconnected.connected).toBe(false);
    expect(disconnected.problems).toContain("Some atoms aren't connected to the rest");
    expect(disconnected.problems).toContain("2 H atoms still want 1 more bond");
    expect(checkMolecule(EMPTY_GRAPH).problems).toContain("Add at least two atoms");
  });
});
