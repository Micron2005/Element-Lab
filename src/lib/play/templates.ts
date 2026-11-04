import { analyzeNucleus } from "../nuclear";
import { benchById } from "../bench/library";
import { DEFAULT_CONDITIONS } from "../bench/conditions";
import type { Experiment, Hazard, Product, RunResult } from "../bench/types";
import { REACTIONS } from "../bench/reactions";
import { KNOWN_MOLECULES, localizeMolecule } from "./molecule";
import type { AtomQuest, Grade, MoleculeQuest, MixQuest, Quest, Stars } from "./quests";
import { DEFAULT_LOCALE, tr, type Locale, type MessageKey } from "../i18n";

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
  | { type: "mix"; title?: string; story?: string; hint?: string; targets: MixTargets }
  | { type: "nucleus"; title?: string; story?: string; hint?: string; targets: NucleusTargets };

const NON_SOLID = new Set<Product>(["nothing", "solution", "clumps", "dangerous"]);
const PRODUCT_LABEL_KEYS: Record<Product, MessageKey> = {
  nothing: "play.ui.product.nothing",
  solution: "play.ui.product.solution",
  gel: "play.ui.product.gel",
  slime: "play.ui.product.slime",
  fiber: "play.ui.product.fiber",
  film: "play.ui.product.film",
  adhesive: "play.ui.product.adhesive",
  solid: "play.ui.product.solid",
  clumps: "play.ui.product.clumps",
  dangerous: "play.ui.product.dangerous",
};
const EVENT_KEYS: Partial<Record<string, MessageKey>> = {
  "bicarbonate-bubbles": "play.template.event.bicarbonate-bubbles",
  transglutaminase: "play.template.event.transglutaminase",
  "protease-digestion": "play.template.event.protease-digestion",
};
const INGREDIENT_KEYS: Partial<Record<string, MessageKey>> = {
  "sodium-bicarbonate": "play.template.ingredient.sodium-bicarbonate",
  transglutaminase: "play.template.ingredient.transglutaminase",
  chitosan: "play.template.ingredient.chitosan",
  mfp5: "play.template.ingredient.mfp5",
  sulfur: "play.template.ingredient.sulfur",
  pva: "play.template.ingredient.pva",
  borax: "play.template.ingredient.borax",
};

function productLabel(product: Product, locale: Locale): string {
  return tr(locale, PRODUCT_LABEL_KEYS[product]);
}

function eventLabel(id: string, fallback: string, locale: Locale): string {
  const key = EVENT_KEYS[id];
  return key ? tr(locale, key) : fallback;
}

function ingredientLabel(id: string, fallback: string, locale: Locale): string {
  const key = INGREDIENT_KEYS[id];
  return key ? tr(locale, key) : fallback;
}

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
      ? [tr(locale, "play.template.product", { products: targets.product.map((product) => productLabel(product, locale)).join(" or ") })]
      : []),
    ...(targets.minStrengthMPa !== undefined ? [tr(locale, "play.template.strength", { value: targets.minStrengthMPa })] : []),
    ...(targets.minStretchPct !== undefined ? [tr(locale, "play.template.stretch", { value: targets.minStretchPct })] : []),
    ...(targets.minTack !== undefined ? [tr(locale, "play.template.stickiness", { value: targets.minTack })] : []),
    ...(targets.maxCostPerKg !== undefined ? [tr(locale, "play.template.cost", { value: targets.maxCostPerKg })] : []),
    ...(targets.maxHazard !== undefined ? [tr(locale, "play.template.hazard", { value: targets.maxHazard })] : []),
    ...(targets.mustHappen ?? []).map((id) => tr(locale, "play.template.eventHappens", {
      event: eventLabel(id, REACTIONS.find((event) => event.id === id)?.name ?? id, locale),
    })),
    ...(targets.mustInclude ?? []).map((id) => tr(locale, "play.template.include", {
      ingredient: ingredientLabel(id, benchById[id]?.name ?? id, locale),
    })),
  ];
}

export function describeTargets(t: QuestTemplate, locale: Locale = DEFAULT_LOCALE): string[] {
  return targetLines(t, locale);
}

function starsFor(checks: { met: boolean; feedback: string }[], locale: Locale): Grade {
  if (checks.length === 0) return { stars: 0, feedback: [tr(locale, "play.template.noGoals")] };
  const met = checks.filter(({ met: didMeet }) => didMeet).length;
  const stars: Stars =
    met === checks.length ? 3 :
    checks.length >= 2 && met === checks.length - 1 ? 2 :
    met > 0 ? 1 : 0;
  return { stars, feedback: checks.map(({ feedback }) => feedback) };
}

function formatNumber(value: number, locale: Locale, places = 1): string {
  const rounded = Number(value.toFixed(places));
  return locale === "es"
    ? rounded.toLocaleString("es", { maximumFractionDigits: places, useGrouping: false })
    : rounded.toString();
}

function mixChecks(targets: MixTargets, experiment: Experiment, result: RunResult, locale: Locale) {
  const solid = !isNotSolid(result.product);
  const checks: { met: boolean; feedback: string }[] = [];
  const add = (met: boolean, text: string) => checks.push({ met, feedback: `${met ? "✓" : "✗"} ${text}` });

  if (targets.product?.length) {
    const labels = targets.product.map((product) => productLabel(product, locale));
    add(targets.product.includes(result.product), tr(locale, "play.template.productResult", {
      result: productLabel(result.product, locale),
      needed: labels.join(" or "),
    }));
  }
  if (targets.minStrengthMPa !== undefined) {
    add(solid && result.tensileMPa >= targets.minStrengthMPa,
      tr(locale, "play.template.strengthResult", { value: formatNumber(result.tensileMPa, locale), needed: targets.minStrengthMPa }));
  }
  if (targets.minStretchPct !== undefined) {
    add(solid && result.elongationPct >= targets.minStretchPct,
      tr(locale, "play.template.stretchResult", { value: formatNumber(result.elongationPct, locale), needed: targets.minStretchPct }));
  }
  if (targets.minTack !== undefined) {
    add(solid && result.tack >= targets.minTack,
      tr(locale, "play.template.stickinessResult", { value: formatNumber(result.tack, locale), needed: targets.minTack }));
  }
  if (targets.maxCostPerKg !== undefined) {
    add(result.costPerKg <= targets.maxCostPerKg,
      tr(locale, "play.template.costResult", { value: formatNumber(result.costPerKg, locale, 2), needed: targets.maxCostPerKg }));
  }
  if (targets.maxHazard !== undefined) {
    const safe = result.wetToxicity <= targets.maxHazard &&
      result.curedToxicity <= targets.maxHazard &&
      result.skin <= targets.maxHazard;
    add(safe, tr(locale, "play.template.hazardResult", {
      wet: result.wetToxicity,
      cured: result.curedToxicity,
      skin: result.skin,
      needed: targets.maxHazard,
    }));
  }
  for (const id of targets.mustHappen ?? []) {
    const event = result.events.find((item) => item.id === id);
    const happened = event?.status === "happened" || event?.status === "partial";
    const status = event?.status === "happened"
      ? tr(locale, "play.ui.status.happened")
      : event?.status === "partial"
        ? tr(locale, "play.ui.status.partial")
        : tr(locale, "play.ui.status.inactive");
    add(happened, tr(locale, "play.template.eventResult", {
      event: eventLabel(id, event?.name ?? REACTIONS.find((item) => item.id === id)?.name ?? id, locale),
      status,
    }));
  }
  for (const id of targets.mustInclude ?? []) {
    const included = experiment.parts.some((part) => part.id === id && part.pct > 0);
    add(included, tr(locale, "play.template.includedResult", {
      ingredient: ingredientLabel(id, benchById[id]?.name ?? id, locale),
      status: tr(locale, included ? "play.ui.status.included" : "play.ui.status.notIncluded"),
    }));
  }
  return checks;
}

function nucleusChecks(targets: NucleusTargets, z: number, n: number, locale: Locale) {
  const report = analyzeNucleus(z, n);
  const checks: { met: boolean; feedback: string }[] = [];
  const add = (met: boolean, text: string) => checks.push({ met, feedback: `${met ? "✓" : "✗"} ${text}` });
  if (targets.z !== undefined) add(z === targets.z, tr(locale, "play.template.zExact", { value: z, needed: targets.z }));
  if (targets.minZ !== undefined) add(z >= targets.minZ, tr(locale, "play.template.zMinimum", { value: z, needed: targets.minZ }));
  if (targets.bound !== undefined) add(report.bound === targets.bound, tr(locale, report.bound ? "play.template.bound" : "play.template.unbound"));
  if (targets.minHalfLifeS !== undefined) {
    add(report.halfLifeSeconds >= targets.minHalfLifeS,
      tr(locale, "play.template.halfLife", {
        value: Number.isFinite(report.halfLifeSeconds) ? `${report.halfLifeSeconds.toExponential(2)} s` : tr(locale, "play.ui.status.stable"),
        needed: targets.minHalfLifeS,
      }));
  }
  return checks;
}

export function compileTemplate(id: string, t: QuestTemplate, locale: Locale = DEFAULT_LOCALE): Quest {
  const goal = targetLines(t, locale).join("; ");
  if (t.type === "molecule") {
    const molecule = KNOWN_MOLECULES.find(({ id: moleculeId }) => moleculeId === t.moleculeId);
    if (!molecule) throw new Error(tr(locale, "play.template.unknownMolecule", { id: t.moleculeId }));
    const localizedMolecule = localizeMolecule(molecule, locale);
    const quest: MoleculeQuest = {
      id,
      chapter: "molecules",
      title: t.title?.trim() || tr(locale, "play.template.buildMolecule", { name: localizedMolecule.name }),
      story: t.story?.trim() || tr(locale, "play.template.moleculeStory"),
      goal,
      hint: t.hint?.trim() || tr(locale, "play.template.checkMolecule", { name: localizedMolecule.name }),
      learn: localizedMolecule.fact,
      starGoals: [
        tr(locale, "play.template.moleculeStar1"),
        tr(locale, "play.template.moleculeStar2"),
        tr(locale, "play.template.moleculeStar3"),
      ] as [string, string, string],
      template: t,
      moleculeId: molecule.id,
      palette: [...new Set([...molecule.graph.atoms.map(({ el }) => el), "H" as const])],
    };
    return quest;
  }

  const base = {
    id,
    title: t.title?.trim() || tr(locale, t.type === "mix" ? "play.template.defaultMixTitle" : "play.template.defaultNucleusTitle"),
    story: t.story?.trim() || tr(locale, "play.template.storyFallback"),
    goal,
    hint: t.hint?.trim() || tr(locale, "play.template.hintFallback"),
    learn: tr(locale, "play.template.learnFallback", { goals: goal }),
    starGoals: [
      tr(locale, "play.template.meetAll"),
      tr(locale, "play.template.meetMost"),
      tr(locale, "play.template.meetOne"),
    ] as [string, string, string],
    template: t,
  };
  if (t.type === "mix") {
    const reference: Experiment = { parts: [], conditions: { ...DEFAULT_CONDITIONS } };
    return {
      ...base,
      chapter: "mixing",
      reference,
      grade: (experiment, result, gradeLocale = DEFAULT_LOCALE) =>
        starsFor(mixChecks(t.targets, experiment, result, gradeLocale), gradeLocale),
    } satisfies MixQuest;
  }
  return {
    ...base,
    chapter: "atoms",
    reference: { z: 1, n: 0 },
    grade: (z, n, gradeLocale = DEFAULT_LOCALE) => {
      try {
        return starsFor(nucleusChecks(t.targets, z, n, gradeLocale), gradeLocale);
      } catch {
        return { stars: 0, feedback: [tr(gradeLocale, "play.template.invalidNucleus")] };
      }
    },
  } satisfies AtomQuest;
}
