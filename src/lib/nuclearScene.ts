import { analyzeNucleus, bindingEnergy, elementName } from "./nuclear";

export type NuclearStepKind = "stable" | "neutron-drip" | "proton-drip" | "fission" | "alpha" | "beta-minus" | "beta-plus" | "neutron-capture";
export interface NucleusRef { z: number; n: number; symbol: string; name: string }
export interface Emission { type: "n" | "p" | "alpha" | "e-" | "e+" | "gamma" | "neutrino"; count: number }
export interface NuclearStep { kind: NuclearStepKind; from: NucleusRef; to: NucleusRef[]; emitted: Emission[]; energyMeV: number; halfLife: string; caption: string }

function assertNucleus(z: number, n: number): void {
  if (!Number.isInteger(z) || z < 1 || !Number.isInteger(n) || n < 0) {
    throw new RangeError("A nucleus needs an integer Z ≥ 1 and N ≥ 0.");
  }
}

function nucleusRef(z: number, n: number): NucleusRef {
  const element = elementName(z);
  return {
    z,
    n,
    symbol: element.symbol,
    name: `${element.name}-${z + n}`,
  };
}

function fissionProducts(z: number, n: number): {
  to: NucleusRef[];
  emitted: Emission[];
  energyMeV: number;
} {
  const neutronCount = z + n >= 240 ? 3 : 2;
  const z1 = Math.round(0.42 * z);
  const z2 = z - z1;
  const n1 = Math.round(((n - neutronCount) * z1) / z);
  const n2 = n - neutronCount - n1;
  const energyMeV =
    bindingEnergy(z1, n1) +
    bindingEnergy(z2, n2) -
    bindingEnergy(z, n);
  return {
    to: [nucleusRef(z1, n1), nucleusRef(z2, n2)],
    emitted: [{ type: "n", count: neutronCount }],
    energyMeV,
  };
}

function stableStep(z: number, n: number, halfLife: string): NuclearStep {
  const nucleus = nucleusRef(z, n);
  return {
    kind: "stable",
    from: nucleus,
    to: [nucleus],
    emitted: [],
    energyMeV: 0,
    halfLife,
    caption: `${nucleus.name} is stable.`,
  };
}

function stepForMode(z: number, n: number): NuclearStep {
  const report = analyzeNucleus(z, n);
  const from = nucleusRef(z, n);
  const mode = report.modes[0];
  if (!mode) return stableStep(z, n, report.halfLife);

  if (mode.startsWith("Neutron drips off")) {
    if (n === 0) return stableStep(z, n, report.halfLife);
    const to = nucleusRef(z, n - 1);
    return {
      kind: "neutron-drip",
      from,
      to: [to],
      emitted: [{ type: "n", count: 1 }],
      energyMeV: Math.abs(report.sn),
      halfLife: report.halfLife,
      caption: `A neutron drips away: ${from.name} → ${to.name}.`,
    };
  }

  if (mode.startsWith("Proton drips off")) {
    if (z <= 1) return stableStep(z, n, report.halfLife);
    const to = nucleusRef(z - 1, n);
    return {
      kind: "proton-drip",
      from,
      to: [to],
      emitted: [{ type: "p", count: 1 }],
      energyMeV: Math.abs(report.sp),
      halfLife: report.halfLife,
      caption: `A proton drips away: ${from.name} → ${to.name}.`,
    };
  }

  if (mode.startsWith("Splits in two") || mode.startsWith("Spontaneous fission")) {
    const fission = fissionProducts(z, n);
    return {
      kind: "fission",
      from,
      ...fission,
      halfLife: report.halfLife,
      caption: `The nucleus splits: ${from.name} → ${fission.to.map((fragment) => fragment.name).join(" + ")}.`,
    };
  }

  if (mode.startsWith("Alpha decay")) {
    if (z <= 2 || n <= 2) return stableStep(z, n, report.halfLife);
    const to = nucleusRef(z - 2, n - 2);
    return {
      kind: "alpha",
      from,
      to: [to],
      emitted: [{ type: "alpha", count: 1 }],
      energyMeV: report.qAlpha,
      halfLife: report.halfLife,
      caption: `An alpha particle leaves: ${from.name} → ${to.name} + alpha.`,
    };
  }

  if (mode.startsWith("Beta-minus")) {
    if (n <= 0) return stableStep(z, n, report.halfLife);
    const to = nucleusRef(z + 1, n - 1);
    return {
      kind: "beta-minus",
      from,
      to: [to],
      emitted: [
        { type: "e-", count: 1 },
        { type: "neutrino", count: 1 },
      ],
      energyMeV: report.qBetaMinus,
      halfLife: report.halfLife,
      caption: `A neutron turns into a proton and shoots out an electron: ${from.name} → ${to.name}.`,
    };
  }

  if (mode.startsWith("Beta-plus")) {
    if (z <= 1) return stableStep(z, n, report.halfLife);
    const to = nucleusRef(z - 1, n + 1);
    return {
      kind: "beta-plus",
      from,
      to: [to],
      emitted: [
        { type: "e+", count: 1 },
        { type: "neutrino", count: 1 },
      ],
      energyMeV: report.qBetaPlus,
      halfLife: report.halfLife,
      caption: `A proton turns into a neutron and emits a positron: ${from.name} → ${to.name}.`,
    };
  }

  return stableStep(z, n, report.halfLife);
}

export function decayChain(z: number, n: number, maxSteps = 8): NuclearStep[] {
  assertNucleus(z, n);
  const steps: NuclearStep[] = [];
  const limit = Math.max(0, Math.floor(maxSteps));
  let currentZ = z;
  let currentN = n;
  for (let index = 0; index < limit; index += 1) {
    const step = stepForMode(currentZ, currentN);
    steps.push(step);
    if (step.kind === "stable" || step.kind === "fission") break;
    const daughter = step.to[0];
    currentZ = daughter.z;
    currentN = daughter.n;
  }
  return steps;
}

export function neutronHit(z: number, n: number): NuclearStep {
  assertNucleus(z, n);
  const from = nucleusRef(z, n);
  const compoundN = n + 1;
  const compound = analyzeNucleus(z, compoundN);
  if (z >= 90 && compound.fissility > 0.7) {
    const fission = fissionProducts(z, compoundN);
    return {
      kind: "fission",
      from,
      ...fission,
      energyMeV: fission.energyMeV + compound.sn,
      halfLife: compound.halfLife,
      caption: `The nucleus captures a neutron and splits: ${from.name} → ${fission.to.map((fragment) => fragment.name).join(" + ")}.`,
    };
  }
  const to = nucleusRef(z, compoundN);
  return {
    kind: "neutron-capture",
    from,
    to: [to],
    emitted: [{ type: "gamma", count: 1 }],
    energyMeV: compound.sn,
    halfLife: compound.halfLife,
    caption: `A neutron is captured and a gamma ray is released: ${from.name} → ${to.name}.`,
  };
}
