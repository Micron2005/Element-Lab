import { analyzeNucleus, bindingEnergy, type NucleusReport } from "./nuclear";
import {
  fissionProducts,
  nucleusRef,
  type Emission,
  type NuclearStep,
  type NucleusRef,
} from "./nuclearScene";

const AMU_MEV = 931.494;
const ALPHA = 1 / 137.036;
const HBAR_OMEGA_MEV = 4;
const BOLTZMANN_MEV_PER_K = 8.617e-11;
const MEASURED_BINDING = new Map<string, number>([
  ["0,1", 0],
  ["1,0", 0],
  ["1,1", 2.224566],
  ["1,2", 8.481798],
  ["2,1", 7.718043],
  ["2,2", 28.295673],
  ["2,3", 27.4057],
  ["2,4", 29.2686],
  ["3,3", 31.99454],
  ["3,4", 39.2446],
  ["4,3", 37.6004],
  ["4,4", 56.4995],
  ["4,5", 58.165],
  ["5,5", 64.7507],
  ["5,6", 76.2051],
  ["6,5", 73.4399],
  ["6,6", 92.1617],
  ["6,7", 97.108],
  ["6,8", 105.2845],
  ["7,6", 94.1054],
  ["7,7", 104.6587],
  ["7,8", 115.4919],
  ["8,7", 111.9554],
  ["8,8", 127.6193],
  ["8,9", 131.7627],
  ["8,10", 139.8078],
  ["9,10", 147.8013],
  ["10,10", 160.6448],
]);
const MEASURED_HALF_LIFE = new Map<string, string>([
  ["1,0", "stable"],
  ["1,1", "stable"],
  ["1,2", "12.3 years"],
  ["2,1", "stable"],
  ["2,2", "stable"],
  ["2,3", "about 7×10⁻²² s (drops a neutron)"],
  ["2,4", "0.81 s"],
  ["3,3", "stable"],
  ["3,4", "stable"],
  ["4,3", "53 days"],
  ["4,4", "about 8×10⁻¹⁷ s (splits into two alphas)"],
  ["4,5", "stable"],
  ["5,5", "stable"],
  ["5,6", "stable"],
  ["6,5", "20.4 minutes"],
  ["6,6", "stable"],
  ["6,7", "stable"],
  ["6,8", "5,730 years"],
  ["7,6", "10.0 minutes"],
  ["7,7", "stable"],
  ["7,8", "stable"],
  ["8,7", "2.0 minutes"],
  ["8,8", "stable"],
  ["8,9", "stable"],
  ["8,10", "stable"],
  ["9,10", "stable"],
  ["10,10", "stable"],
]);

export interface Projectile {
  id: string;
  label: string;
  z: number;
  n: number;
}

export const PROJECTILES: Projectile[] = [
  { id: "p", label: "p", z: 1, n: 0 },
  { id: "d", label: "d", z: 1, n: 1 },
  { id: "t", label: "t", z: 1, n: 2 },
  { id: "he3", label: "He-3", z: 2, n: 1 },
  { id: "he4", label: "He-4", z: 2, n: 2 },
  { id: "c12", label: "C-12", z: 6, n: 6 },
  { id: "o16", label: "O-16", z: 8, n: 8 },
  { id: "ca48", label: "Ca-48", z: 20, n: 28 },
  { id: "ti50", label: "Ti-50", z: 22, n: 28 },
  { id: "cr54", label: "Cr-54", z: 24, n: 30 },
  { id: "fe58", label: "Fe-58", z: 26, n: 32 },
  { id: "ni64", label: "Ni-64", z: 28, n: 36 },
  { id: "zn70", label: "Zn-70", z: 30, n: 40 },
];

export interface FusionRecipe {
  id: string;
  label: string;
  projectileId: string;
  target: { z: number; n: number };
  beam: { labMeV: number } | { barrierFactor: number };
  realNote: string;
}

export const FUSION_RECIPES: FusionRecipe[] = [
  {
    id: "dt",
    label: "D + T (fusion power)",
    projectileId: "d",
    target: { z: 1, n: 2 },
    beam: { labMeV: 0.107 },
    realNote: "The reaction fusion reactors like ITER use. It gives off 17.6 MeV.",
  },
  {
    id: "dd",
    label: "D + D",
    projectileId: "d",
    target: { z: 1, n: 1 },
    beam: { labMeV: 0.1 },
    realNote:
      "Real D + D splits two ways, about equally: He-3 + n or T + p. The model follows the easier one.",
  },
  {
    id: "pli",
    label: "p + Li-7 (1932)",
    projectileId: "p",
    target: { z: 3, n: 4 },
    beam: { labMeV: 0.4 },
    realNote:
      "Cockcroft and Walton's 1932 experiment, the first nucleus split with an accelerator: it gives two alpha particles.",
  },
  {
    id: "nobelium",
    label: "Ca-48 + Pb-208",
    projectileId: "ca48",
    target: { z: 82, n: 126 },
    beam: { barrierFactor: 1 },
    realNote: "Used to make nobelium-254 (2 neutrons off, about 2 microbarns).",
  },
  {
    id: "nihonium",
    label: "Zn-70 + Bi-209",
    projectileId: "zn70",
    target: { z: 83, n: 126 },
    beam: { barrierFactor: 1 },
    realNote:
      "RIKEN made nihonium-278 this way: 3 atoms in about 9 years (2003–2012).",
  },
  {
    id: "oganesson",
    label: "Ca-48 + Cf-249",
    projectileId: "ca48",
    target: { z: 98, n: 151 },
    beam: { barrierFactor: 1.03 },
    realNote:
      "Dubna made oganesson-294 this way (2002–2005): a handful of atoms, about 0.5 picobarns.",
  },
  {
    id: "tennessine",
    label: "Ca-48 + Bk-249",
    projectileId: "ca48",
    target: { z: 97, n: 152 },
    beam: { barrierFactor: 1.03 },
    realNote: "Tennessine was first made this way in 2010.",
  },
  {
    id: "e120",
    label: "Ti-50 + Cf-249 → 120?",
    projectileId: "ti50",
    target: { z: 98, n: 151 },
    beam: { barrierFactor: 1.03 },
    realNote: "Labs are trying this now. No atom of element 120 has been seen yet.",
  },
];

export interface FusionReport {
  light: boolean;
  reaction: string;
  dominant: "bounce" | "quasi-fission" | "fusion-fission" | "fuses";
  successPossible: boolean;
  headline: string;
  barrierMeV: number;
  ecmMeV: number;
  qMeV: number;
  excitationMeV: number;
  emitted: Emission[];
  energyReleasedMeV: number;
  chancePerCollision: number;
  chancePerTouch: number;
  crossSectionBarn?: number;
  atomsPerDay?: number;
  plasmaMillionC?: number;
  residue: NucleusRef[];
  residueReport?: NucleusReport;
  residueMeasured: boolean;
  notes: string[];
  steps: NuclearStep[];
}

interface Separation {
  type: "n" | "p" | "alpha";
  energy: number;
  z: number;
  n: number;
}

function massKey(z: number, n: number): string {
  return `${z},${n}`;
}

export function bestBinding(z: number, n: number): number {
  return MEASURED_BINDING.get(massKey(z, n)) ?? bindingEnergy(z, n);
}

export function measuredHalfLife(z: number, n: number): string | undefined {
  return MEASURED_HALF_LIFE.get(massKey(z, n));
}

function barrierMeV(
  projectile: { z: number; n: number },
  target: { z: number; n: number },
): number {
  const a1 = projectile.z + projectile.n;
  const a2 = target.z + target.n;
  const radius = 1.4 * (Math.cbrt(a1) + Math.cbrt(a2));
  return (1.44 * projectile.z * target.z) / radius;
}

export function beamForBarrier(
  projectile: { z: number; n: number },
  target: { z: number; n: number },
  factor: number,
): number {
  const a1 = projectile.z + projectile.n;
  const a2 = target.z + target.n;
  return (barrierMeV(projectile, target) * factor * (a1 + a2)) / a2;
}

function compactNumber(value: number): string {
  return Number(value.toPrecision(3)).toString();
}

export function fmtCrossSection(barn: number): string {
  if (!Number.isFinite(barn) || barn < 1e-15) return "< 1 fb";
  const scales = [
    [1, "b"],
    [1e-3, "mb"],
    [1e-6, "µb"],
    [1e-9, "nb"],
    [1e-12, "pb"],
    [1e-15, "fb"],
  ] as const;
  const [scale, unit] = scales.find(([threshold]) => barn >= threshold)!;
  return `${compactNumber(barn / scale)} ${unit}`;
}

export function fmtOneIn(probability: number): string {
  if (!Number.isFinite(probability) || probability <= 0) return "never";
  if (probability >= 0.5) return "most hits";
  const odds = 1 / probability;
  if (odds >= 1e12) {
    const exponent = Math.floor(Math.log10(odds));
    const coefficient = Number((odds / 10 ** exponent).toPrecision(2));
    return coefficient === 1
      ? `1 in 10^${exponent}`
      : `1 in ${compactNumber(coefficient)}×10^${exponent}`;
  }
  return `1 in ${Math.round(odds).toLocaleString("en-US")}`;
}

function separations(z: number, n: number): Separation[] {
  const binding = bestBinding(z, n);
  const choices: Separation[] = [];
  if (n >= 1) {
    choices.push({ type: "n", energy: binding - bestBinding(z, n - 1), z, n: n - 1 });
  }
  if (z >= 2) {
    choices.push({ type: "p", energy: binding - bestBinding(z - 1, n), z: z - 1, n });
  }
  if (z >= 4 && n >= 4) {
    choices.push({
      type: "alpha",
      energy: binding - bestBinding(2, 2) - bestBinding(z - 2, n - 2),
      z: z - 2,
      n: n - 2,
    });
  }
  return choices;
}

function addEmission(emitted: Emission[], type: Emission["type"], count = 1): void {
  const existing = emitted.find((item) => item.type === type);
  if (existing) existing.count += count;
  else emitted.push({ type, count });
}

function formatNucleus(ref: NucleusRef): string {
  return `${ref.symbol}-${ref.z + ref.n}`;
}

function reactionProducts(residue: NucleusRef[], emitted: Emission[]): string[] {
  const products = residue.map(formatNucleus);
  for (const { type, count } of emitted) {
    if (type === "alpha") continue;
    const name = type === "gamma" ? "γ" : type;
    products.push(`${count > 1 ? `${count} ` : ""}${name}`);
  }
  return products;
}

function reactionLabel(
  projectile: NucleusRef,
  target: NucleusRef,
  compound: NucleusRef,
  residue: NucleusRef[],
  emitted: Emission[],
): string {
  const products = reactionProducts(residue, emitted);
  return `${formatNucleus(projectile)} + ${formatNucleus(target)} → ${formatNucleus(compound)}* → ${products.length ? products.join(" + ") : "no product"}`;
}

function mostHits(dominant: FusionReport["dominant"]): string {
  if (dominant === "bounce") return "Most hits: the projectile bounces off.";
  if (dominant === "quasi-fission") {
    return "Most hits: the pair separates before the nuclei fully fuse.";
  }
  if (dominant === "fusion-fission") {
    return "Most hits: the compound nucleus splits before it can cool.";
  }
  return "The nuclei fuse and the compound cools.";
}

function oneInPhrase(probability: number): string {
  const value = fmtOneIn(probability);
  return value.startsWith("1 in ") ? value.slice(5) : value;
}

function failureStep(
  dominant: Exclude<FusionReport["dominant"], "fuses">,
  target: NucleusRef,
  projectile: NucleusRef,
  compound: NucleusRef,
): NuclearStep {
  if (dominant === "fusion-fission") {
    return {
      kind: dominant,
      from: target,
      projectile,
      ...fissionProducts(compound.z, compound.n),
      halfLife: "",
      caption: mostHits(dominant),
    };
  }
  return {
    kind: dominant,
    from: target,
    projectile,
    to: dominant === "bounce" ? [target] : [projectile, target],
    emitted: [],
    energyMeV: 0,
    halfLife: "",
    caption: mostHits(dominant),
  };
}

function fusionStep(
  target: NucleusRef,
  projectile: NucleusRef,
  compound: NucleusRef,
  excitationMeV: number,
  caption: string,
): NuclearStep {
  return {
    kind: "fusion",
    from: target,
    projectile,
    to: [compound],
    emitted: [],
    energyMeV: excitationMeV,
    halfLife: "",
    caption,
  };
}

function survivalFactor(fissility: number): number {
  const exponent = Math.max(-3, Math.min(3, -12 * (fissility - 0.72)));
  const r = 10 ** exponent;
  return r / (1 + r);
}

function finishReport(
  projectile: { z: number; n: number },
  target: { z: number; n: number },
  beamLabMeV: number,
): FusionReport {
  const a1 = projectile.z + projectile.n;
  const a2 = target.z + target.n;
  const compoundZ = projectile.z + target.z;
  const compoundN = projectile.n + target.n;
  const compoundA = compoundZ + compoundN;
  const compound = nucleusRef(compoundZ, compoundN);
  const projectileRef = nucleusRef(projectile.z, projectile.n);
  const targetRef = nucleusRef(target.z, target.n);
  const ecmMeV = (beamLabMeV * a2) / (a1 + a2);
  const radius = 1.4 * (Math.cbrt(a1) + Math.cbrt(a2));
  const barrier = (1.44 * projectile.z * target.z) / radius;
  const qMeV =
    bestBinding(compoundZ, compoundN) -
    bestBinding(projectile.z, projectile.n) -
    bestBinding(target.z, target.n);
  const excitationMeV = ecmMeV + qMeV;
  const light = compoundA <= 20;
  const notes = [
    "Rough model: liquid-drop masses (measured masses for a few light nuclei), a simple barrier, and rough fusion and survival estimates. Real cross sections can be 10–1000× different.",
  ];
  const steps: NuclearStep[] = [];
  let dominant: FusionReport["dominant"];
  let successPossible = true;
  let chancePerTouch = 1;
  let chancePerCollision = 0;
  let crossSectionBarn: number | undefined;
  let atomsPerDay: number | undefined;
  let plasmaMillionC: number | undefined;
  const emitted: Emission[] = [];
  let residue: NucleusRef[] = [];
  let energyReleasedMeV = 0;
  let residueReport: NucleusReport | undefined;

  if (light) {
    const reducedMass = (a1 * a2 * AMU_MEV) / (a1 + a2);
    const egMeV =
      2 * reducedMass * (Math.PI * ALPHA * projectile.z * target.z) ** 2;
    const pTouch =
      ecmMeV >= barrier
        ? 1
        : ecmMeV > 0
          ? Math.exp(
              -(
                Math.sqrt(egMeV / ecmMeV) -
                Math.sqrt(egMeV / barrier)
              ),
            )
          : 0;
    dominant = pTouch < 0.5 ? "bounce" : "fuses";
    chancePerCollision = pTouch;
    plasmaMillionC = ecmMeV / BOLTZMANN_MEV_PER_K / 1e6;
    notes.push(
      "Real fusion fuel is a hot plasma, so most bumps bounce off; it works because there are trillions of them.",
    );

    let residueZ = compoundZ;
    let residueN = compoundN;
    let emittedAlpha = false;
    const easiest = separations(compoundZ, compoundN).sort(
      (left, right) => left.energy - right.energy,
    )[0];
    if (easiest && (easiest.energy <= 0 || easiest.energy < excitationMeV)) {
      addEmission(emitted, easiest.type);
      residueZ = easiest.z;
      residueN = easiest.n;
      emittedAlpha = easiest.type === "alpha";
    } else {
      addEmission(emitted, "gamma");
    }

    let residuePieces = [nucleusRef(residueZ, residueN)];
    if (residueZ >= 4 && residueN >= 4) {
      const alphaSeparation =
        bestBinding(residueZ, residueN) -
        bestBinding(2, 2) -
        bestBinding(residueZ - 2, residueN - 2);
      if (alphaSeparation <= 0) {
        residuePieces = [
          nucleusRef(2, 2),
          nucleusRef(residueZ - 2, residueN - 2),
        ];
        addEmission(emitted, "alpha");
      }
    }
    residue = [...(emittedAlpha ? [nucleusRef(2, 2)] : []), ...residuePieces];
    energyReleasedMeV =
      residue.reduce((sum, item) => sum + bestBinding(item.z, item.n), 0) -
      bestBinding(projectile.z, projectile.n) -
      bestBinding(target.z, target.n);
  } else {
    const exponent = (2 * Math.PI * (ecmMeV - barrier)) / HBAR_OMEGA_MEV;
    const logOnePlusExp =
      exponent > 0
        ? exponent + Math.log1p(Math.exp(-exponent))
        : Math.log1p(Math.exp(exponent));
    const sigmaCaptureFm2 =
      ecmMeV > 0
        ? ((HBAR_OMEGA_MEV * radius ** 2) / (2 * ecmMeV)) *
          logOnePlusExp
        : 0;
    const touchFrac = Math.min(1, sigmaCaptureFm2 / (Math.PI * radius ** 2));
    const zProduct = projectile.z * target.z;
    const pCompound =
      zProduct <= 1600 ? 1 : Math.exp(-(zProduct - 1600) / 80);
    const compoundFissility = (compoundZ ** 2) / compoundA / 50.9;

    if (excitationMeV < 0) {
      successPossible = false;
      dominant = "bounce";
      chancePerTouch = 0;
    } else if (compoundFissility >= 1) {
      successPossible = false;
      dominant = "fusion-fission";
      chancePerTouch = 0;
    } else {
      const currentZ = compoundZ;
      let currentN = compoundN;
      let remainingExcitation = excitationMeV;
      let survival = 1;
      let neutronCount = 0;
      for (let index = 0; index < 10; index += 1) {
        if (currentN <= 0) break;
        const fissility = (currentZ ** 2) / (currentZ + currentN) / 50.9;
        const neutronSeparation =
          bindingEnergy(currentZ, currentN) -
          bindingEnergy(currentZ, currentN - 1);
        if (neutronSeparation > 0 && remainingExcitation <= neutronSeparation) {
          break;
        }
        if (neutronSeparation > 0) {
          const kinetic = Math.min(2, remainingExcitation - neutronSeparation);
          remainingExcitation -= neutronSeparation + kinetic;
        }
        survival *= survivalFactor(fissility);
        currentN -= 1;
        neutronCount += 1;
      }
      if (neutronCount === 0) survival *= survivalFactor(compoundFissility);
      if (remainingExcitation > 0.1) addEmission(emitted, "gamma");
      if (neutronCount > 0) addEmission(emitted, "n", neutronCount);
      residue = [nucleusRef(currentZ, currentN)];
      energyReleasedMeV =
        bestBinding(currentZ, currentN) -
        bestBinding(projectile.z, projectile.n) -
        bestBinding(target.z, target.n);
      chancePerTouch = pCompound * survival;
      chancePerCollision = touchFrac * chancePerTouch;
      crossSectionBarn = sigmaCaptureFm2 * 0.01 * pCompound * survival;
      atomsPerDay = crossSectionBarn * 5.184e11;

      if (ecmMeV < 0.999 * barrier) dominant = "bounce";
      else if (pCompound < 0.5) dominant = "quasi-fission";
      else if (survival < 0.5) dominant = "fusion-fission";
      else dominant = "fuses";
    }

    if (!successPossible) {
      chancePerCollision = 0;
      crossSectionBarn = 0;
      atomsPerDay = 0;
      energyReleasedMeV =
        -bestBinding(projectile.z, projectile.n) -
        bestBinding(target.z, target.n);
    }
  }

  const residueMeasured =
    residue.length > 0 &&
    residue.every((item) => MEASURED_BINDING.has(massKey(item.z, item.n)));
  if (residue.length === 1) {
    residueReport = analyzeNucleus(residue[0].z, residue[0].n);
  }
  if (residue.some((item) => item.z >= 119)) {
    const predictedZ = Math.max(...residue.map((item) => item.z));
    notes.push(
      `No lab has made element ${predictedZ} yet. This is a prediction, not a discovery.`,
    );
  }
  if (
    residue.some((item) => {
      const key = massKey(item.z, item.n);
      if (key === "2,3" || key === "4,4") return true;
      if (measuredHalfLife(item.z, item.n) !== undefined) return false;
      const report = analyzeNucleus(item.z, item.n);
      return !report.bound || report.fissility >= 1;
    })
  ) {
    notes.push("In this model the product falls apart instantly.");
  }

  const reaction = reactionLabel(
    projectileRef,
    targetRef,
    compound,
    residue,
    emitted,
  );
  const products = reactionProducts(residue, emitted);
  const successCaption = `1 hit in ${oneInPhrase(chancePerCollision)}: ${products.join(" + ") || "the compound forms"}.`;
  if (dominant !== "fuses") {
    steps.push(failureStep(dominant, targetRef, projectileRef, compound));
  }
  if (successPossible && chancePerCollision >= 1e-30) {
    steps.push(
      fusionStep(
        targetRef,
        projectileRef,
        compound,
        excitationMeV,
        successCaption,
      ),
    );
    steps.push({
      kind: "evaporation",
      from: compound,
      projectile: projectileRef,
      to: residue,
      emitted,
      energyMeV: energyReleasedMeV,
      halfLife:
        residue.length === 1
          ? (measuredHalfLife(residue[0].z, residue[0].n) ??
            residueReport?.halfLife ??
            "")
          : "",
      caption: `The compound cools: ${products.join(" + ") || "no residue"}.`,
    });
  }

  return {
    light,
    reaction,
    dominant,
    successPossible,
    headline:
      dominant === "fuses"
        ? mostHits(dominant)
        : `${mostHits(dominant)}${successPossible && chancePerCollision >= 1e-30 ? ` ${successCaption}` : ""}`,
    barrierMeV: barrier,
    ecmMeV,
    qMeV,
    excitationMeV,
    emitted,
    energyReleasedMeV,
    chancePerCollision,
    chancePerTouch,
    ...(crossSectionBarn === undefined ? {} : { crossSectionBarn }),
    ...(atomsPerDay === undefined ? {} : { atomsPerDay }),
    ...(plasmaMillionC === undefined ? {} : { plasmaMillionC }),
    residue,
    ...(residueReport ? { residueReport } : {}),
    residueMeasured,
    notes,
    steps,
  };
}

export function fuse(
  projectile: { z: number; n: number },
  target: { z: number; n: number },
  beamLabMeV: number,
): FusionReport {
  return finishReport(projectile, target, Math.max(0, beamLabMeV));
}
