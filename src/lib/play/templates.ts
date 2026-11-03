import { analyzeNucleus } from "../nuclear";
import { benchById } from "../bench/library";
import { DEFAULT_CONDITIONS } from "../bench/conditions";
import type { Experiment, Hazard, Product, RunResult } from "../bench/types";
import { REACTIONS } from "../bench/reactions";
import { KNOWN_MOLECULES, localizeMolecule } from "./molecule";
import type { AtomQuest, Grade, MoleculeQuest, MixQuest, Quest, Stars } from "./quests";
import { DEFAULT_LOCALE, tr, type Locale } from "../i18n";

export interface MixTargets {
  product?: Product[];
  minStrengthMPa?: number;
  minStretchPct?: number;
  minTack?: number;
  maxCostPerKg?: number;
  maxHazard?: Hazard;
  mustHappen?: string[];
  mustInclude?: string[];
}

export interface NucleusTargets {
  z?: number;
  minZ?: number;
  bound?: boolean;
  minHalfLifeS?: number;
}

export type QuestTemplate =
  | { type: "molecule"; moleculeId: string; title?: string; story?: string; hint?: string }
  | { type: "mix"; title: string; story?: string; hint?: string; targets: MixTargets }
  | { type: "nucleus"; title: string; story?: string; hint?: string; targets: NucleusTargets };

const NON_SOLID = new Set<Product>(["nothing", "solution", "clumps", "dangerous"]);
const PRODUCT_LABELS: Record<Product, string> = {
  nothing: "No useful solid",
  solution: "Solution or weak mixture",
  gel: "Crosslinked gel",
  slime: "Reversible slime",
  fiber: "Fiber",
  film: "Film",
  adhesive: "Adhesive",
  solid: "Cured solid",
  clumps: "Clumps",
  dangerous: "Dangerous reaction",
};
const STAR_GOALS: [string, string, string] = [
  "Meet every goal.",
  "Meet all but one goal.",
  "Meet at least one goal.",
];

export function isNotSolid(product: Product): boolean {
  return NON_SOLID.has(product);
}

function targetLines(t: QuestTemplate, locale: Locale = DEFAULT_LOCALE): string[] {
  if (t.type === "molecule") {
    const molecule = KNOWN_MOLECULES.find(({ id }) => id === t.moleculeId);
    return molecule
      ? [tr(locale, "play.target.buildMolecule", {
          name: localizeMolecule(molecule, locale).name,
          formula: molecule.formula,
        })]
      : [];
  }
  if (t.type === "nucleus") {
    const targets = t.targets;
    return [
      ...(targets.z !== undefined ? [tr(locale, "play.target.protonExact", { z: targets.z })] : []),
      ...(targets.minZ !== undefined ? [tr(locale, "play.target.protonMinimum", { z: targets.minZ })] : []),
      ...(targets.bound !== undefined ? [tr(locale, targets.bound ? "play.target.bound" : "play.target.unbound")] : []),
      ...(targets.minHalfLifeS !== undefined ? [tr(locale, "play.target.halfLifeMinimum", { seconds: targets.minHalfLifeS })] : []),
    ];
  }
  const targets = t.targets;
  return [
    ...(targets.product?.length
      ? [`Product: ${targets.product.map((product) => PRODUCT_LABELS[product]).join(" or ")}`]
      : []),
    ...(targets.minStrengthMPa !== undefined ? [`Strength at least ${targets.minStrengthMPa} MPa`] : []),
    ...(targets.minStretchPct !== undefined ? [`Stretch at least ${targets.minStretchPct}%`] : []),
    ...(targets.minTack !== undefined ? [`Stickiness at least ${targets.minTack}/10`] : []),
    ...(targets.maxCostPerKg !== undefined ? [`Cost at most $${targets.maxCostPerKg}/kg`] : []),
    ...(targets.maxHazard !== undefined ? [`Wet, cured, and skin hazard at most level ${targets.maxHazard}`] : []),
    ...(targets.mustHappen ?? []).map((id) => `${REACTIONS.find((event) => event.id === id)?.name ?? id} happens`),
    ...(targets.mustInclude ?? []).map((id) => `Include ${benchById[id]?.name ?? id}`),
  ];
}

export function describeTargets(t: QuestTemplate, locale: Locale = DEFAULT_LOCALE): string[] {
  return targetLines(t, locale);
}

function starsFor(checks: { met: boolean; feedback: string }[]): Grade {
  if (checks.length === 0) return { stars: 0, feedback: ["This quest has no goals yet."] };
  const met = checks.filter(({ met: didMeet }) => didMeet).length;
  const stars: Stars =
    met === checks.length ? 3 :
    checks.length >= 2 && met === checks.length - 1 ? 2 :
    met > 0 ? 1 : 0;
  return { stars, feedback: checks.map(({ feedback }) => feedback) };
}

function formatNumber(value: number, places = 1): string {
  return Number(value.toFixed(places)).toString();
}

function mixChecks(targets: MixTargets, experiment: Experiment, result: RunResult) {
  const solid = !isNotSolid(result.product);
  const checks: { met: boolean; feedback: string }[] = [];
  const add = (met: boolean, text: string) => checks.push({ met, feedback: `${met ? "✓" : "✗"} ${text}` });

  if (targets.product?.length) {
    const labels = targets.product.map((product) => PRODUCT_LABELS[product]);
    add(targets.product.includes(result.product), `Product ${result.productLabel} (need ${labels.join(" or ")})`);
  }
  if (targets.minStrengthMPa !== undefined) {
    add(solid && result.tensileMPa >= targets.minStrengthMPa,
      `Strength ${formatNumber(result.tensileMPa)} MPa (need ≥ ${targets.minStrengthMPa})`);
  }
  if (targets.minStretchPct !== undefined) {
    add(solid && result.elongationPct >= targets.minStretchPct,
      `Stretch ${formatNumber(result.elongationPct)}% (need ≥ ${targets.minStretchPct})`);
  }
  if (targets.minTack !== undefined) {
    add(solid && result.tack >= targets.minTack,
      `Stickiness ${formatNumber(result.tack)} /10 (need ≥ ${targets.minTack})`);
  }
  if (targets.maxCostPerKg !== undefined) {
    add(result.costPerKg <= targets.maxCostPerKg,
      `Cost $${formatNumber(result.costPerKg, 2)}/kg (need ≤ $${targets.maxCostPerKg}/kg)`);
  }
  if (targets.maxHazard !== undefined) {
    const safe = result.wetToxicity <= targets.maxHazard &&
      result.curedToxicity <= targets.maxHazard &&
      result.skin <= targets.maxHazard;
    add(safe, `Wet/cured/skin hazard ${result.wetToxicity}/${result.curedToxicity}/${result.skin} (need ≤ ${targets.maxHazard})`);
  }
  for (const id of targets.mustHappen ?? []) {
    const event = result.events.find((item) => item.id === id);
    const happened = event?.status === "happened" || event?.status === "partial";
    add(happened, `${event?.name ?? REACTIONS.find((item) => item.id === id)?.name ?? id} ${event?.status ?? "not active"} (need happened or partial)`);
  }
  for (const id of targets.mustInclude ?? []) {
    const included = experiment.parts.some((part) => part.id === id && part.pct > 0);
    add(included, `${benchById[id]?.name ?? id} ${included ? "included" : "not included"}`);
  }
  return checks;
}

function nucleusChecks(targets: NucleusTargets, z: number, n: number) {
  const report = analyzeNucleus(z, n);
  const checks: { met: boolean; feedback: string }[] = [];
  const add = (met: boolean, text: string) => checks.push({ met, feedback: `${met ? "✓" : "✗"} ${text}` });
  if (targets.z !== undefined) add(z === targets.z, `Z ${z} (need ${targets.z})`);
  if (targets.minZ !== undefined) add(z >= targets.minZ, `Z ${z} (need ≥ ${targets.minZ})`);
  if (targets.bound !== undefined) add(report.bound === targets.bound, `Nucleus ${report.bound ? "is bound" : "is not bound"} (need ${targets.bound ? "bound" : "not bound"})`);
  if (targets.minHalfLifeS !== undefined) {
    add(report.halfLifeSeconds >= targets.minHalfLifeS,
      `Half-life ${Number.isFinite(report.halfLifeSeconds) ? `${report.halfLifeSeconds.toExponential(2)} s` : "stable"} (need ≥ ${targets.minHalfLifeS} s)`);
  }
  return checks;
}

export function compileTemplate(id: string, t: QuestTemplate, locale: Locale = DEFAULT_LOCALE): Quest {
  const goal = targetLines(t, locale).join("; ");
  if (t.type === "molecule") {
    const molecule = KNOWN_MOLECULES.find(({ id: moleculeId }) => moleculeId === t.moleculeId);
    if (!molecule) throw new Error(`Unknown molecule template: ${t.moleculeId}`);
    const localizedMolecule = localizeMolecule(molecule, locale);
    const quest: MoleculeQuest = {
      id,
      chapter: "molecules",
      title: t.title?.trim() || tr(locale, "play.template.buildMolecule", { name: localizedMolecule.name }),
      story: t.story?.trim() || tr(locale, "play.template.moleculeStory"),
      goal,
      hint: t.hint?.trim() || tr(locale, "play.template.checkMolecule", { name: localizedMolecule.name }),
      learn: localizedMolecule.fact,
      starGoals: ["Build the correct, complete molecule.", "Use no more than one hint.", "Build it without hints."],
      template: t,
      moleculeId: molecule.id,
      palette: [...new Set([...molecule.graph.atoms.map(({ el }) => el), "H" as const])],
    };
    return quest;
  }

  const base = {
    id,
    title: t.title.trim(),
    story: t.story?.trim() || "Use the model to test the goals for this challenge.",
    goal,
    hint: t.hint?.trim() || "Change one part of the setup at a time and compare the result.",
    learn: `This challenge uses these modeled goals: ${goal}`,
    starGoals: STAR_GOALS,
    template: t,
  };
  if (t.type === "mix") {
    const reference: Experiment = { parts: [], conditions: { ...DEFAULT_CONDITIONS } };
    return {
      ...base,
      chapter: "mixing",
      reference,
      grade: (experiment, result) => starsFor(mixChecks(t.targets, experiment, result)),
    } satisfies MixQuest;
  }
  return {
    ...base,
    chapter: "atoms",
    reference: { z: 1, n: 0 },
    grade: (z, n) => {
      try {
        return starsFor(nucleusChecks(t.targets, z, n));
      } catch {
        return { stars: 0, feedback: ["Enter valid proton and neutron counts for the nucleus model."] };
      }
    },
  } satisfies AtomQuest;
}
