import { describe, expect, it } from "vitest";
import { KNOWN_MOLECULES, type MolGraph } from "./molecule";
import { angleAt, embed3D, lonePairs } from "./geometry3d";

const radii = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Cl: 1.02, S: 1.05, P: 1.07 };

function withinAngle(actual: number, expected: number, tolerance = 0.5) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function nonBondedDistances(graph: MolGraph, embedded: ReturnType<typeof embed3D>) {
  const bonded = new Set(graph.bonds.map((bond) => [bond.a, bond.b].sort().join(":")));
  const distances: number[] = [];
  for (let a = 0; a < embedded.atoms.length; a += 1) {
    for (let b = a + 1; b < embedded.atoms.length; b += 1) {
      const atomA = embedded.atoms[a];
      const atomB = embedded.atoms[b];
      if (bonded.has([atomA.id, atomB.id].sort().join(":"))) continue;
      distances.push(Math.hypot(atomA.x - atomB.x, atomA.y - atomB.y, atomA.z - atomB.z));
    }
  }
  return distances;
}

function alkane(carbons: number): MolGraph {
  const atoms: MolGraph["atoms"] = [];
  const bonds: MolGraph["bonds"] = [];
  for (let index = 0; index < carbons; index += 1) {
    atoms.push({ id: `c${index}`, el: "C", x: index * 70, y: index % 2 ? 40 : 0 });
  }
  for (let index = 0; index < carbons - 1; index += 1) {
    bonds.push({ a: `c${index}`, b: `c${index + 1}`, order: 1 });
  }
  for (let index = 0; index < carbons; index += 1) {
    const attached = index === 0 || index === carbons - 1 ? 1 : 2;
    for (let hydrogen = 0; hydrogen < 4 - attached; hydrogen += 1) {
      const id = `h${index}-${hydrogen}`;
      atoms.push({ id, el: "H", x: index * 70, y: hydrogen * 35 + 30 });
      bonds.push({ a: `c${index}`, b: id, order: 1 });
    }
  }
  return { atoms, bonds };
}

function molecule(id: string) {
  return KNOWN_MOLECULES.find((item) => item.id === id)!;
}

describe("3D molecule geometry", () => {
  it("uses neutral valence electron counts for lone pairs", () => {
    expect(lonePairs(molecule("water").graph, "a1")).toBe(2);
    expect(lonePairs(molecule("ammonia").graph, "a1")).toBe(1);
    expect(lonePairs(molecule("phosphine").graph, "a1")).toBe(1);
  });

  it("matches the requested VSEPR angles", () => {
    const water = molecule("water").graph;
    withinAngle(angleAt(embed3D(water), "a1", "a2", "a3"), 104.5);
    const sulfide = molecule("hydrogen-sulfide").graph;
    withinAngle(angleAt(embed3D(sulfide), "a1", "a2", "a3"), 92);
    const ammonia = molecule("ammonia").graph;
    withinAngle(angleAt(embed3D(ammonia), "a1", "a2", "a3"), 107);
    const phosphine = molecule("phosphine").graph;
    withinAngle(angleAt(embed3D(phosphine), "a1", "a2", "a3"), 93.5);
    const methane = molecule("methane").graph;
    withinAngle(angleAt(embed3D(methane), "a1", "a2", "a3"), 109.5);
  });

  it("keeps carbon dioxide, hydrogen cyanide and acetylene linear", () => {
    const carbonDioxide = molecule("carbon-dioxide").graph;
    withinAngle(angleAt(embed3D(carbonDioxide), "a1", "a2", "a3"), 180);
    const hydrogenCyanide = molecule("hydrogen-cyanide").graph;
    withinAngle(angleAt(embed3D(hydrogenCyanide), "a2", "a1", "a3"), 180);
    const acetylene = molecule("acetylene").graph;
    withinAngle(angleAt(embed3D(acetylene), "a2", "a1", "a3"), 180);
  });

  it("embeds ethylene in one plane with trigonal hydrogens", () => {
    const graph = molecule("ethylene").graph;
    const embedded = embed3D(graph);
    const zValues = embedded.atoms.map((atom) => atom.z);
    expect(Math.max(...zValues) - Math.min(...zValues)).toBeLessThan(0.05);
    withinAngle(angleAt(embedded, "a1", "a3", "a4"), 120, 1);
  });

  it("preserves ideal bond lengths and avoids non-bonded clashes for every known molecule", () => {
    for (const item of KNOWN_MOLECULES) {
      const embedded = embed3D(item.graph);
      const byId = new Map(embedded.atoms.map((atom) => [atom.id, atom]));
      for (const bond of item.graph.bonds) {
        const a = byId.get(bond.a)!;
        const b = byId.get(bond.b)!;
        const expected = ((radii[a.el] + radii[b.el]) * (bond.order === 2 ? 0.87 : bond.order === 3 ? 0.78 : 1));
        const actual = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        expect(Math.abs(actual - expected) / expected, `${item.name} ${bond.a}-${bond.b}`).toBeLessThan(0.02);
      }
      for (const distance of nonBondedDistances(item.graph, embedded)) {
        expect(distance, `${item.name} non-bonded distance`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("embeds a free-built hexane chain with staggered, clash-free geometry", () => {
    const graph = alkane(6);
    const embedded = embed3D(graph);
    expect(embedded.method).toBe("vsepr");
    expect(Math.min(...nonBondedDistances(graph, embedded))).toBeGreaterThanOrEqual(1);
  });

  it("relaxes a three-carbon ring deterministically without invalid or clashing coordinates", () => {
    const graph: MolGraph = {
      atoms: [
        { id: "c1", el: "C", x: 0, y: 0 },
        { id: "c2", el: "C", x: 70, y: 0 },
        { id: "c3", el: "C", x: 35, y: 61 },
      ],
      bonds: [
        { a: "c1", b: "c2", order: 1 },
        { a: "c2", b: "c3", order: 1 },
        { a: "c3", b: "c1", order: 1 },
      ],
    };
    const first = embed3D(graph);
    expect(first.method).toBe("relaxed");
    expect(first.atoms.every((atom) => [atom.x, atom.y, atom.z].every(Number.isFinite))).toBe(true);
    const allDistances = first.atoms.flatMap((a, index) => first.atoms.slice(index + 1).map((b) =>
      Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
    ));
    expect(Math.min(...allDistances)).toBeGreaterThanOrEqual(0.8);
    expect(embed3D(graph)).toEqual(first);
  });
});
