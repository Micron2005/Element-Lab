import { analyzeNucleus, bindingEnergy, elementName } from "./nuclear";
import { DEFAULT_LOCALE, tr, type Locale } from "./i18n";

export type NuclearStepKind = "stable" | "neutron-drip" | "proton-drip" | "fission" | "alpha" | "beta-minus" | "beta-plus" | "neutron-capture" | "bounce" | "quasi-fission" | "fusion-fission" | "fusion" | "evaporation";
export interface NucleusRef { z: number; n: number; symbol: string; name: string }
export interface Emission { type: "n" | "p" | "alpha" | "e-" | "e+" | "gamma" | "neutrino"; count: number }
export interface NuclearStep { kind: NuclearStepKind; from: NucleusRef; to: NucleusRef[]; emitted: Emission[]; energyMeV: number; halfLife: string; caption: string; projectile?: NucleusRef }

function assertNucleus(z: number, n: number, locale: Locale = DEFAULT_LOCALE): void {
  if (!Number.isInteger(z) || z < 1 || !Number.isInteger(n) || n < 0) {
    throw new RangeError(tr(locale, "elements.scene.invalidInput"));
  }
}

export function nucleusRef(z: number, n: number): NucleusRef {
  const element = elementName(z);
  return {
    z,
    n,
    symbol: element.symbol,
    name: `${element.name}-${z + n}`,
  };
}

export function fissionProducts(z: number, n: number): {
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

function stableStep(z: number, n: number, halfLife: string, locale: Locale): NuclearStep {
  const nucleus = nucleusRef(z, n);
  return {
    kind: "stable",
    from: nucleus,
    to: [nucleus],
    emitted: [],
    energyMeV: 0,
    halfLife,
    caption: tr(locale, "elements.scene.stable", { name: nucleus.name }),
  };
}

function stepForMode(z: number, n: number, locale: Locale): NuclearStep {
  const report = analyzeNucleus(z, n, locale);
  const from = nucleusRef(z, n);
  const mode = report.modeIds[0];
  if (!mode) return stableStep(z, n, report.halfLife, locale);

  if (mode === "neutron-drip") {
    if (n === 0) return stableStep(z, n, report.halfLife, locale);
    const to = nucleusRef(z, n - 1);
    return {
      kind: "neutron-drip",
      from,
      to: [to],
      emitted: [{ type: "n", count: 1 }],
      energyMeV: Math.abs(report.sn),
      halfLife: report.halfLife,
      caption: tr(locale, "elements.scene.neutronDrip", { from: from.name, to: to.name }),
    };
  }

  if (mode === "proton-drip") {
    if (z <= 1) return stableStep(z, n, report.halfLife, locale);
    const to = nucleusRef(z - 1, n);
    return {
      kind: "proton-drip",
      from,
      to: [to],
      emitted: [{ type: "p", count: 1 }],
      energyMeV: Math.abs(report.sp),
      halfLife: report.halfLife,
      caption: tr(locale, "elements.scene.protonDrip", { from: from.name, to: to.name }),
    };
  }

  if (mode === "instant-fission" || mode === "spontaneous-fission") {
    const fission = fissionProducts(z, n);
    return {
      kind: "fission",
      from,
      ...fission,
      halfLife: report.halfLife,
      caption: tr(locale, "elements.scene.fission", { from: from.name, products: fission.to.map((fragment) => fragment.name).join(" + ") }),
    };
  }

  if (mode === "alpha") {
    if (z <= 2 || n <= 2) return stableStep(z, n, report.halfLife, locale);
    const to = nucleusRef(z - 2, n - 2);
    return {
      kind: "alpha",
      from,
      to: [to],
      emitted: [{ type: "alpha", count: 1 }],
      energyMeV: report.qAlpha,
      halfLife: report.halfLife,
      caption: tr(locale, "elements.scene.alpha", { from: from.name, to: to.name }),
    };
  }

  if (mode === "beta-minus") {
    if (n <= 0) return stableStep(z, n, report.halfLife, locale);
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
      caption: tr(locale, "elements.scene.betaMinus", { from: from.name, to: to.name }),
    };
  }

  if (mode === "beta-plus") {
    if (z <= 1) return stableStep(z, n, report.halfLife, locale);
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
      caption: tr(locale, "elements.scene.betaPlus", { from: from.name, to: to.name }),
    };
  }

  return stableStep(z, n, report.halfLife, locale);
}

export function decayChain(z: number, n: number, maxSteps = 8, locale: Locale = DEFAULT_LOCALE): NuclearStep[] {
  assertNucleus(z, n, locale);
  const steps: NuclearStep[] = [];
  const limit = Math.max(0, Math.floor(maxSteps));
  let currentZ = z;
  let currentN = n;
  for (let index = 0; index < limit; index += 1) {
    const step = stepForMode(currentZ, currentN, locale);
    steps.push(step);
    if (step.kind === "stable" || step.kind === "fission") break;
    const daughter = step.to[0];
    currentZ = daughter.z;
    currentN = daughter.n;
  }
  return steps;
}

export function neutronHit(z: number, n: number, locale: Locale = DEFAULT_LOCALE): NuclearStep {
  assertNucleus(z, n, locale);
  const from = nucleusRef(z, n);
  const compoundN = n + 1;
  const compound = analyzeNucleus(z, compoundN, locale);
  if (z >= 90 && compound.fissility > 0.7) {
    const fission = fissionProducts(z, compoundN);
    return {
      kind: "fission",
      from,
      ...fission,
      energyMeV: fission.energyMeV + compound.sn,
      halfLife: compound.halfLife,
      caption: tr(locale, "elements.scene.neutronFission", { from: from.name, products: fission.to.map((fragment) => fragment.name).join(" + ") }),
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
    caption: tr(locale, "elements.scene.capture", { from: from.name, to: to.name }),
  };
}
