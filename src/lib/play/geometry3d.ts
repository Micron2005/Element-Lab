import type { AtomSymbol } from "./atoms";
import type { MolBond, MolGraph } from "./molecule";

export interface Atom3D {
  id: string;
  el: AtomSymbol;
  x: number;
  y: number;
  z: number;
}

export interface Embed3D {
  atoms: Atom3D[];
  bonds: MolBond[];
  method: "vsepr" | "relaxed";
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Neighbor {
  id: string;
  bond: MolBond;
}

const VALENCE_ELECTRONS: Record<AtomSymbol, number> = {
  H: 1,
  C: 4,
  N: 5,
  O: 6,
  F: 7,
  Cl: 7,
  S: 6,
  P: 5,
};

const COVALENT_RADII: Record<AtomSymbol, number> = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  Cl: 1.02,
  S: 1.05,
  P: 1.07,
};

const ATOMIC_WEIGHTS: Record<AtomSymbol, number> = {
  H: 1,
  C: 12,
  N: 14,
  O: 16,
  F: 19,
  Cl: 35.45,
  S: 32,
  P: 31,
};

const DEG = Math.PI / 180;
const EPSILON = 1e-9;

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: Vec3, amount: number): Vec3 {
  return { x: a.x * amount, y: a.y * amount, z: a.z * amount };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function length(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a: Vec3, fallback: Vec3 = { x: 1, y: 0, z: 0 }): Vec3 {
  const magnitude = length(a);
  return magnitude < EPSILON ? fallback : scale(a, 1 / magnitude);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function projectPerpendicular(vector: Vec3, axis: Vec3): Vec3 {
  return subtract(vector, scale(axis, dot(vector, axis)));
}

function neighborMap(graph: MolGraph): Map<string, Neighbor[]> {
  const ids = new Set(graph.atoms.map(({ id }) => id));
  const result = new Map(graph.atoms.map(({ id }) => [id, [] as Neighbor[]]));
  for (const bond of graph.bonds) {
    if (!ids.has(bond.a) || !ids.has(bond.b) || bond.a === bond.b) continue;
    result.get(bond.a)?.push({ id: bond.b, bond });
    result.get(bond.b)?.push({ id: bond.a, bond });
  }
  return result;
}

function bondOrderUsed(graph: MolGraph, id: string): number {
  return graph.bonds.reduce(
    (sum, bond) => sum + (bond.a === id || bond.b === id ? bond.order : 0),
    0,
  );
}

export function lonePairs(graph: MolGraph, id: string): number {
  const atom = graph.atoms.find((item) => item.id === id);
  if (!atom) return 0;
  return Math.max(0, Math.floor((VALENCE_ELECTRONS[atom.el] - bondOrderUsed(graph, id)) / 2));
}

function idealBondAngle(graph: MolGraph, atomId: string, neighbors: Neighbor[]): number {
  const atom = graph.atoms.find((item) => item.id === atomId);
  if (!atom || neighbors.length < 2) return 180;
  const pairs = lonePairs(graph, atomId);
  if (pairs >= 1 && atom.el === "N") return 107;
  if (pairs >= 1 && atom.el === "P") return 93.5;
  if (pairs >= 2 && atom.el === "O") return 104.5;
  if (pairs >= 2 && atom.el === "S") return 92;
  const stericNumber = neighbors.length + pairs;
  if (stericNumber <= 2) return 180;
  if (stericNumber === 3) return 120;
  return 109.5;
}

function bondLength(a: AtomSymbol, b: AtomSymbol, order: number): number {
  const orderFactor = order === 2 ? 0.87 : order === 3 ? 0.78 : 1;
  return (COVALENT_RADII[a] + COVALENT_RADII[b]) * orderFactor;
}

function neighborsByPriority(
  neighbors: Neighbor[],
  atomById: Map<string, MolGraph["atoms"][number]>,
  preferredId?: string,
): Neighbor[] {
  return [...neighbors].sort((a, b) => {
    if (a.id === preferredId) return -1;
    if (b.id === preferredId) return 1;
    const atomA = atomById.get(a.id);
    const atomB = atomById.get(b.id);
    if (!atomA || !atomB) return a.id.localeCompare(b.id);
    const heavy = Number(atomA.el !== "H") - Number(atomB.el !== "H");
    return heavy || ATOMIC_WEIGHTS[atomB.el] - ATOMIC_WEIGHTS[atomA.el] || a.id.localeCompare(b.id);
  });
}

function rootDirections(count: number, angle: number): Vec3[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 1, y: 0, z: 0 }];
  const cosine = Math.cos(angle * DEG);
  if (count === 2) {
    return [
      { x: 1, y: 0, z: 0 },
      { x: cosine, y: Math.sqrt(Math.max(0, 1 - cosine * cosine)), z: 0 },
    ];
  }
  if (count === 4) {
    const tetrahedral = [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: -1, z: -1 },
      { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 },
    ];
    return tetrahedral.map((direction) => normalize(direction));
  }
  if (count === 3) {
    const coneCosine = Math.sqrt(clamp((2 * cosine + 1) / 3, 0, 1));
    const coneRadius = Math.sqrt(Math.max(0, 1 - coneCosine * coneCosine));
    return Array.from({ length: count }, (_, index) => {
      const azimuth = (index * 2 * Math.PI) / count;
      return {
        x: coneRadius * Math.cos(azimuth),
        y: coneRadius * Math.sin(azimuth),
        z: coneCosine,
      };
    });
  }
  return Array.from({ length: count }, (_, index) => {
    const z = 1 - (2 * index + 1) / count;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const azimuth = index * Math.PI * (3 - Math.sqrt(5));
    return { x: radius * Math.cos(azimuth), y: radius * Math.sin(azimuth), z };
  });
}

function perpendicularBasis(axis: Vec3, reference?: Vec3, reverseReference = false): [Vec3, Vec3] {
  let first = reference ? projectPerpendicular(reference, axis) : { x: 0, y: 0, z: 0 };
  if (length(first) < EPSILON) {
    const seed = Math.abs(axis.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    first = projectPerpendicular(seed, axis);
  }
  first = normalize(first);
  if (reverseReference) first = scale(first, -1);
  return [first, normalize(cross(axis, first), { x: 0, y: 0, z: 1 })];
}

function localDirections(
  graph: MolGraph,
  atomId: string,
  parent: Neighbor,
  children: Neighbor[],
  grandparentId: string | null,
  neighbors: Neighbor[],
  positions: Map<string, Vec3>,
  atomById: Map<string, MolGraph["atoms"][number]>,
): Map<string, Vec3> {
  const center = positions.get(atomId)!;
  const parentPosition = positions.get(parent.id)!;
  const axis = normalize(subtract(parentPosition, center));
  const angle = idealBondAngle(graph, atomId, neighbors);
  const cosine = Math.cos(angle * DEG);
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const childrenOrdered = neighborsByPriority(children, atomById);
  const result = new Map<string, Vec3>([[parent.id, axis]]);
  if (childrenOrdered.length === 0) return result;

  const doubleBondToParent =
    parent.bond.order === 2 &&
    ["C", "N"].includes(atomById.get(atomId)?.el ?? "") &&
    ["C", "N"].includes(atomById.get(parent.id)?.el ?? "");
  let reference: Vec3 | undefined;
  let reverseReference = false;
  if (doubleBondToParent) {
    const otherOnParent = neighborMap(graph).get(parent.id)?.find((item) => item.id !== atomId);
    if (otherOnParent) {
      const otherPosition = positions.get(otherOnParent.id);
      if (otherPosition) reference = subtract(otherPosition, parentPosition);
    }
  }

  const preferredChild = childrenOrdered.find((neighbor) => {
    const atom = atomById.get(neighbor.id);
    return atom?.el === "C";
  });
  if (
    !reference &&
    grandparentId &&
    atomById.get(atomId)?.el === "C" &&
    atomById.get(parent.id)?.el === "C" &&
    parent.bond.order === 1 &&
    preferredChild
  ) {
    const grandparent = positions.get(grandparentId);
    if (grandparent) {
      reference = subtract(grandparent, parentPosition);
      reverseReference = true;
    }
  }

  const [first, second] = perpendicularBasis(axis, reference, reverseReference);
  const neighborCount = neighbors.length;
  let azimuths: number[];
  if (neighborCount === 2) {
    azimuths = [0];
  } else if (neighborCount === 3 && Math.abs(angle - 120) < 1e-6) {
    azimuths = [0, Math.PI];
  } else if (neighborCount === 3) {
    const delta = Math.acos(clamp(cosine / (1 + cosine), -1, 1));
    azimuths = [-delta / 2, delta / 2];
  } else {
    azimuths = childrenOrdered.map((_neighbor, index) => (index * 2 * Math.PI) / childrenOrdered.length);
  }

  for (let index = 0; index < childrenOrdered.length; index += 1) {
    const azimuth = azimuths[index] ?? (index * 2 * Math.PI) / childrenOrdered.length;
    const radial = add(scale(first, Math.cos(azimuth)), scale(second, Math.sin(azimuth)));
    result.set(childrenOrdered[index].id, normalize(add(scale(axis, cosine), scale(radial, sine))));
  }
  return result;
}

function buildAdjacency(graph: MolGraph, atomById: Map<string, MolGraph["atoms"][number]>) {
  const adjacency = neighborMap(graph);
  for (const neighbors of adjacency.values()) {
    neighbors.sort((a, b) => a.id.localeCompare(b.id));
  }
  const componentSeen = new Set<string>();
  let components = 0;
  for (const atom of graph.atoms) {
    if (componentSeen.has(atom.id)) continue;
    components += 1;
    const pending = [atom.id];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (componentSeen.has(id)) continue;
      componentSeen.add(id);
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!componentSeen.has(neighbor.id)) pending.push(neighbor.id);
      }
    }
  }
  const validBonds = graph.bonds.filter((bond) => atomById.has(bond.a) && atomById.has(bond.b));
  return {
    adjacency,
    components,
    cyclic: validBonds.length > graph.atoms.length - components,
  };
}

function embedVsepr(graph: MolGraph, adjacency: Map<string, Neighbor[]>): Vec3[] {
  const atomById = new Map(graph.atoms.map((atom) => [atom.id, atom]));
  const root = [...graph.atoms].sort((a, b) =>
    (adjacency.get(b.id)?.length ?? 0) - (adjacency.get(a.id)?.length ?? 0) ||
    ATOMIC_WEIGHTS[b.el] - ATOMIC_WEIGHTS[a.el] ||
    a.id.localeCompare(b.id),
  )[0];
  if (!root) return [];

  const positions = new Map<string, Vec3>([[root.id, { x: 0, y: 0, z: 0 }]]);
  const visited = new Set<string>([root.id]);
  const queue: { id: string; parentId: string | null; grandparentId: string | null }[] = [
    { id: root.id, parentId: null, grandparentId: null },
  ];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const allNeighbors = adjacency.get(current.id) ?? [];
    const children = allNeighbors.filter((neighbor) =>
      neighbor.id !== current.parentId && !visited.has(neighbor.id),
    );
    const parent = current.parentId
      ? allNeighbors.find((neighbor) => neighbor.id === current.parentId)
      : undefined;
    const orderedChildren = neighborsByPriority(children, atomById);
    const center = positions.get(current.id)!;
    let directions: Map<string, Vec3>;
    if (parent) {
      directions = localDirections(
        graph,
        current.id,
        parent,
        orderedChildren,
        current.grandparentId,
        allNeighbors,
        positions,
        atomById,
      );
    } else {
      const ordered = neighborsByPriority(orderedChildren, atomById);
      const generated = rootDirections(ordered.length, idealBondAngle(graph, current.id, allNeighbors));
      directions = new Map(ordered.map((neighbor, index) => [neighbor.id, generated[index]]));
    }
    for (const child of orderedChildren) {
      if (visited.has(child.id)) continue;
      const childAtom = atomById.get(child.id);
      if (!childAtom) continue;
      const direction = directions.get(child.id) ?? { x: 1, y: 0, z: 0 };
      const next = add(center, scale(direction, bondLength(atomById.get(current.id)!.el, childAtom.el, child.bond.order)));
      positions.set(child.id, next);
      visited.add(child.id);
      queue.push({ id: child.id, parentId: current.id, grandparentId: current.parentId });
    }
  }
  return graph.atoms.map((atom) => positions.get(atom.id) ?? { x: 0, y: 0, z: 0 });
}

function deterministicUnit(indexA: number, indexB: number): Vec3 {
  const angle = (Math.min(indexA, indexB) + 1) * 2.399963229728653 + (Math.max(indexA, indexB) + 1) * 0.731;
  const sign = indexA < indexB ? 1 : -1;
  return normalize({ x: Math.cos(angle), y: Math.sin(angle), z: Math.sin(angle * 0.7) * sign });
}

function embedRelaxed(graph: MolGraph): Vec3[] {
  const atomById = new Map(graph.atoms.map((atom) => [atom.id, atom]));
  const indexById = new Map(graph.atoms.map((atom, index) => [atom.id, index]));
  const positions = graph.atoms.map((atom, index) => ({
    x: atom.x / 70,
    y: atom.y / 70,
    z: Math.sin((index + 1) * 1.61803398875) * 0.025,
  }));
  const bonds = graph.bonds.flatMap((bond) => {
    const a = atomById.get(bond.a);
    const b = atomById.get(bond.b);
    const aIndex = indexById.get(bond.a);
    const bIndex = indexById.get(bond.b);
    return a && b && aIndex !== undefined && bIndex !== undefined
      ? [{ a, b, aIndex, bIndex, target: bondLength(a.el, b.el, bond.order) }]
      : [];
  });
  const bonded = new Set(bonds.map(({ aIndex, bIndex }) => `${Math.min(aIndex, bIndex)}:${Math.max(aIndex, bIndex)}`));
  for (let iteration = 0; iteration < 400; iteration += 1) {
    const forces = graph.atoms.map(() => ({ x: 0, y: 0, z: 0 }));
    for (const bond of bonds) {
      const delta = subtract(positions[bond.bIndex], positions[bond.aIndex]);
      const distance = Math.max(length(delta), EPSILON);
      const force = scale(delta, ((distance - bond.target) / distance) * 0.16);
      forces[bond.aIndex] = add(forces[bond.aIndex], force);
      forces[bond.bIndex] = subtract(forces[bond.bIndex], force);
    }
    for (let aIndex = 0; aIndex < positions.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < positions.length; bIndex += 1) {
        if (bonded.has(`${aIndex}:${bIndex}`)) continue;
        let delta = subtract(positions[bIndex], positions[aIndex]);
        let distance = length(delta);
        if (distance >= 1.15) continue;
        if (distance < EPSILON) {
          delta = deterministicUnit(aIndex, bIndex);
          distance = 1;
        }
        const force = scale(delta, ((1.15 - distance) / distance) * 0.12);
        forces[aIndex] = subtract(forces[aIndex], force);
        forces[bIndex] = add(forces[bIndex], force);
      }
    }
    positions.forEach((position, index) => {
      positions[index] = add(position, forces[index]);
    });
  }
  return positions;
}

function center(atoms: Vec3[]): Vec3[] {
  if (atoms.length === 0) return atoms;
  const centroid = atoms.reduce(
    (sum, atom) => add(sum, atom),
    { x: 0, y: 0, z: 0 },
  );
  const mean = scale(centroid, 1 / atoms.length);
  return atoms.map((atom) => subtract(atom, mean));
}

export function embed3D(graph: MolGraph): Embed3D {
  const atomById = new Map(graph.atoms.map((atom) => [atom.id, atom]));
  const { adjacency, components, cyclic } = buildAdjacency(graph, atomById);
  const relaxed = cyclic || components > 1;
  const coords = center(relaxed ? embedRelaxed(graph) : embedVsepr(graph, adjacency));
  return {
    atoms: graph.atoms.map((atom, index) => ({
      id: atom.id,
      el: atom.el,
      x: coords[index]?.x ?? 0,
      y: coords[index]?.y ?? 0,
      z: coords[index]?.z ?? 0,
    })),
    bonds: graph.bonds.map((bond) => ({ ...bond })),
    method: relaxed ? "relaxed" : "vsepr",
  };
}

export function angleAt(embed: Embed3D, centerId: string, aId: string, bId: string): number {
  const byId = new Map(embed.atoms.map((atom) => [atom.id, atom]));
  const centerAtom = byId.get(centerId);
  const atomA = byId.get(aId);
  const atomB = byId.get(bId);
  if (!centerAtom || !atomA || !atomB || centerId === aId || centerId === bId) {
    throw new Error("angleAt requires three distinct atom ids in the embedded molecule");
  }
  const vectorA = normalize(subtract(atomA, centerAtom));
  const vectorB = normalize(subtract(atomB, centerAtom));
  return Math.acos(clamp(dot(vectorA, vectorB), -1, 1)) / DEG;
}
