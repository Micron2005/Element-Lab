import type { Category, Experiment, Forming, Product, RunResult } from "./types";
import { benchById } from "./library";
import { eventParticipantIds } from "./participants";
import { solventBoilingPointC, waterBoilingPointC } from "./conditions";

export type EffectKind = "bonds" | "bubbles" | "heat" | "evaporate" | "clump" | "digest" | "spark" | "dissolve" | "color" | "align";
export interface SceneSpecies { id: string; name: string; color: string; category: Category; count: number; density: number; pourIndex: number }
export interface SceneEffect { kind: EffectKind; eventId: string; label: string; species: string[]; start: number; end: number; strength: number; color?: string }
export interface ScenePhase { id: "pour" | "mix" | "react" | "set" | "final"; label: string; start: number; end: number; realSeconds: number }
export type FinalShape = "liquid" | "gel" | "strand" | "film" | "block" | "clumps" | "foam" | "empty" | "hazard";
export interface MixScene {
  species: SceneSpecies[];
  stirSpeed: number;       // 0..1
  thermal: number;         // 0..1
  mixCompleteness: number; // 0..1 by the end of the mix phase
  atmosphere: "air" | "nitrogen" | "vacuum";
  boiling: boolean;
  forming: Forming;
  product: Product;
  finalShape: FinalShape;
  network: number;         // 0..1 share of particles bonded at the end
  phases: ScenePhase[];
  effects: SceneEffect[];
  blocked: { eventId: string; label: string }[];
  totalRealSeconds: number;
}

const CATEGORY_COLORS: Record<Category, string> = {
  element: "#c9d1d9",
  salt: "#f0bd69",
  protein: "#ef8fb1",
  enzyme: "#b48cff",
  polymer: "#49d5c2",
  solvent: "#5aa9ff",
  "acid-base": "#ff7b6b",
  additive: "#9be36d",
  filler: "#8a8f98",
};

const EFFECT_COLORS: Record<EffectKind, string> = {
  bonds: "#49d5c2",
  bubbles: "#5aa9ff",
  heat: "#ff7b6b",
  evaporate: "#c9d1d9",
  clump: "#8a8f98",
  digest: "#b48cff",
  spark: "#f0bd69",
  dissolve: "#5aa9ff",
  color: "#ef8fb1",
  align: "#ef8fb1",
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function shiftLightness(hex: string, categoryIndex: number): string {
  if (categoryIndex === 0) return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  const red = ((value >> 16) & 255) / 255;
  const green = ((value >> 8) & 255) / 255;
  const blue = (value & 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);
    switch (max) {
      case red:
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
    }
    hue /= 6;
  }
  const direction = categoryIndex % 2 === 1 ? 1 : -1;
  const step = Math.ceil(categoryIndex / 2);
  const adjustedLightness = clamp01(lightness + direction * 0.12 * step);
  const adjustedHue = hue + direction * 0.06 * step;
  const hueToRgb = (p: number, q: number, t: number) => {
    let adjusted = t;
    if (adjusted < 0) adjusted += 1;
    if (adjusted > 1) adjusted -= 1;
    if (adjusted < 1 / 6) return p + (q - p) * 6 * adjusted;
    if (adjusted < 1 / 2) return q;
    if (adjusted < 2 / 3) return p + (q - p) * (2 / 3 - adjusted) * 6;
    return p;
  };
  const q = adjustedLightness < 0.5
    ? adjustedLightness * (1 + saturation)
    : adjustedLightness + saturation - adjustedLightness * saturation;
  const p = 2 * adjustedLightness - q;
  const shifted = saturation === 0
    ? [adjustedLightness, adjustedLightness, adjustedLightness]
    : [
        hueToRgb(p, q, adjustedHue + 1 / 3),
        hueToRgb(p, q, adjustedHue),
        hueToRgb(p, q, adjustedHue - 1 / 3),
      ];
  return `#${shifted.map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0")).join("")}`;
}

function buildSpecies(experiment: Experiment): SceneSpecies[] {
  const categoryCounts = new Map<Category, number>();
  return experiment.parts.flatMap((part, pourIndex) => {
    if (part.pct <= 0) return [];
    const ingredient = benchById[part.id];
    if (!ingredient) return [];
    const categoryIndex = categoryCounts.get(ingredient.category) ?? 0;
    categoryCounts.set(ingredient.category, categoryIndex + 1);
    return [{
      id: ingredient.id,
      name: ingredient.name,
      color: shiftLightness(CATEGORY_COLORS[ingredient.category], categoryIndex),
      category: ingredient.category,
      count: Math.max(6, Math.min(120, Math.round((part.pct / 100) * 160))),
      density: ingredient.density,
      pourIndex,
    }];
  });
}

function getBoilingState(experiment: Experiment): boolean {
  const solvents = experiment.parts
    .map((part) => ({ part, ingredient: benchById[part.id] }))
    .filter(({ part, ingredient }) =>
      part.pct > 0 && ingredient?.category === "solvent" && ingredient.boilC !== undefined,
    );
  if (!solvents.length) return false;
  const lowestBoilingPoint = Math.min(...solvents.map(({ ingredient }) =>
    ingredient?.id === "water"
      ? waterBoilingPointC(experiment.conditions.pressureKPa)
      : solventBoilingPointC(ingredient!.boilC!, experiment.conditions.pressureKPa),
  ));
  return experiment.conditions.tempC >= lowestBoilingPoint;
}

function phaseLabel(
  id: ScenePhase["id"],
  experiment: Experiment,
  result: RunResult,
): string {
  switch (id) {
    case "pour":
      return "Pour the ingredients into the mixer";
    case "mix":
      if (experiment.conditions.mixRpm === 0) return "Resting, no stirring";
      if (experiment.conditions.mixMinutes <= 0) return "No mixing time";
      return `Stirring at ${experiment.conditions.mixRpm} rpm for ${experiment.conditions.mixMinutes} min`;
    case "react": {
      const activeEvents = result.events.filter((event) =>
        event.status === "happened" || event.status === "partial",
      );
      const eventName = activeEvents[0]?.name ?? "The mixture";
      return `${eventName} – sets in ~${Math.round(result.setSeconds)} s`;
    }
    case "set":
      return `Curing for ${experiment.conditions.cureMinutes} min`;
    case "final":
      return "The finished mixture";
  }
}

function buildPhases(experiment: Experiment, result: RunResult): ScenePhase[] {
  const middle: { id: ScenePhase["id"]; realSeconds: number }[] = [];
  const mixSeconds = experiment.conditions.mixRpm === 0
    ? 0
    : Math.max(0, experiment.conditions.mixMinutes) * 60;
  const reactSeconds = Math.max(0, result.setSeconds);
  const cureSeconds = experiment.conditions.forming === "heat-cure"
    ? Math.max(0, experiment.conditions.cureMinutes) * 60
    : 0;
  if (mixSeconds > 0) middle.push({ id: "mix", realSeconds: mixSeconds });
  if (reactSeconds > 0) middle.push({ id: "react", realSeconds: reactSeconds });
  if (cureSeconds > 0) middle.push({ id: "set", realSeconds: cureSeconds });
  if (!middle.length) {
    middle.push({ id: "mix", realSeconds: 0 });
  }

  const minimum = 0.1;
  const remaining = 0.76 - middle.length * minimum;
  const weightTotal = middle.reduce(
    (total, phase) => total + Math.log10(1 + phase.realSeconds),
    0,
  );
  const allocations = middle.map((phase) =>
    minimum + (weightTotal > 0
      ? remaining * Math.log10(1 + phase.realSeconds) / weightTotal
      : remaining / middle.length),
  );
  const phases: ScenePhase[] = [{
    id: "pour",
    label: phaseLabel("pour", experiment, result),
    start: 0,
    end: 0.12,
    realSeconds: 5,
  }];
  let position = 0.12;
  middle.forEach((phase, index) => {
    const end = position + allocations[index];
    phases.push({
      id: phase.id,
      label: phaseLabel(phase.id, experiment, result),
      start: position,
      end,
      realSeconds: phase.realSeconds,
    });
    position = end;
  });
  phases.push({
    id: "final",
    label: phaseLabel("final", experiment, result),
    start: position,
    end: 1,
    realSeconds: 0,
  });
  return phases;
}

function describeEvent(event: RunResult["events"][number]): string {
  const mechanism = event.mechanism.trim().replace(/[.!?]+$/, "");
  const caption = `${event.name}: ${mechanism}`;
  return caption.length <= 100 ? caption : `${caption.slice(0, 97).trimEnd()}…`;
}

function effectSpecs(eventId: string): { kind: EffectKind; label?: string; color?: string }[] {
  let specs: { kind: EffectKind; label?: string; color?: string }[];
  switch (eventId) {
    case "silk-beta-sheet":
      specs = [{ kind: "align" }];
      break;
    case "pu-moisture-cure":
      specs = [{ kind: "bonds" }, { kind: "bubbles", label: "CO₂ bubbles form" }];
      break;
    case "protease-digestion":
      specs = [{ kind: "digest" }];
      break;
    case "sodium-water":
      specs = [
        { kind: "spark" },
        { kind: "heat" },
        { kind: "bubbles", label: "Hydrogen bubbles form" },
      ];
      break;
    case "bicarbonate-bubbles":
      specs = [{ kind: "bubbles", label: "CO₂ bubbles form" }];
      break;
    case "chitosan-solubility":
      specs = [{ kind: "dissolve" }];
      break;
    default:
      specs = [{ kind: "bonds" }];
  }
  const colorShifts: Record<string, { label: string; color: string }> = {
    "genipin-amine": { label: "Blue color develops", color: "#3b6cff" },
    "catechol-oxidation": { label: "Brown color develops", color: "#8b5a2b" },
    "glutaraldehyde-amine": { label: "Amber color develops", color: "#d99a42" },
  };
  const colorShift = colorShifts[eventId];
  if (colorShift) {
    specs.push({ kind: "color", ...colorShift });
  }
  return specs;
}

function effectLabel(
  event: RunResult["events"][number],
  kind: EffectKind,
  label?: string,
): string {
  if (label) return `${label}: ${describeEvent(event)}`;
  if (kind === "color") return `Color changes: ${describeEvent(event)}`;
  return describeEvent(event);
}

const ON_CONTACT_EVENTS = new Set(["sodium-water", "bicarbonate-bubbles"]);

function buildEffects(experiment: Experiment, result: RunResult, phases: ScenePhase[]): {
  effects: SceneEffect[];
  blocked: { eventId: string; label: string }[];
} {
  const activeEvents = result.events.filter((event) =>
    event.status === "happened" || event.status === "partial",
  );
  const blocked = result.events
    .filter((event) => event.status === "blocked")
    .map((event) => ({
      eventId: event.id,
      label: `${event.name}: ${event.reasons[0] ?? "conditions prevented this reaction."}`,
    }));
  const reactPhase = phases.find((phase) => phase.id === "react");
  const setPhase = phases.find((phase) => phase.id === "set");
  const mixPhase = phases.find((phase) => phase.id === "mix");
  const pourPhase = phases.find((phase) => phase.id === "pour");
  const finalPhase = phases.find((phase) => phase.id === "final");
  const hasReactionPhase = Boolean(reactPhase || setPhase);
  const activeStart = hasReactionPhase
    ? reactPhase?.start ?? setPhase?.start ?? 0
    : finalPhase?.start ?? mixPhase?.end ?? pourPhase?.end ?? 0;
  const activeEnd = hasReactionPhase
    ? setPhase?.end ?? reactPhase?.end ?? finalPhase?.start ?? 1
    : finalPhase?.end ?? 1;
  const span = Math.max(0, activeEnd - activeStart);
  const effects: SceneEffect[] = activeEvents.flatMap((event, index) => {
    const participants = eventParticipantIds(event.id, experiment.parts);
    const species = experiment.parts
      .filter((part) => participants.has(part.id))
      .map((part) => part.id);
    const onContact = ON_CONTACT_EVENTS.has(event.id);
    const contactStart = pourPhase?.end ?? activeStart;
    const start = onContact
      ? contactStart
      : activeEvents.length > 1
        ? activeStart + span * (index / activeEvents.length)
        : activeStart;
    const end = onContact
      ? Math.max(start + 0.2, finalPhase?.start ?? activeEnd)
      : Math.min(activeEnd, start + span * 0.5);
    return effectSpecs(event.id).map((spec) => ({
      kind: spec.kind,
      eventId: event.id,
      label: effectLabel(event, spec.kind, spec.label),
      species,
      start,
      end,
      strength: clamp01(event.activity),
      color: spec.color ?? EFFECT_COLORS[spec.kind],
    }));
  });

  const volatileSolvents = experiment.parts.filter((part) =>
    part.pct > 0 && benchById[part.id]?.category === "solvent" &&
    benchById[part.id]?.boilC !== undefined,
  );
  const shouldEvaporate =
    ((experiment.conditions.forming === "extrude-air" ||
      experiment.conditions.forming === "cast-film") &&
      volatileSolvents.length > 0) ||
    getBoilingState(experiment);
  if (shouldEvaporate) {
    const evaporationStart = setPhase?.start ?? reactPhase?.start ?? finalPhase?.start ?? 0.88;
    effects.push({
      kind: "evaporate",
      eventId: "evaporation",
      label: getBoilingState(experiment)
        ? "Solvent boils and evaporates"
        : "Volatile solvent evaporates during forming",
      species: volatileSolvents.map((part) => part.id),
      start: evaporationStart,
      end: finalPhase?.end ?? 1,
      strength: getBoilingState(experiment) ? 1 : 0.5,
      color: EFFECT_COLORS.evaporate,
    });
  }
  return { effects, blocked };
}

function shapeForProduct(product: Product): FinalShape {
  switch (product) {
    case "nothing":
    case "solution":
      return "liquid";
    case "gel":
    case "slime":
      return "gel";
    case "fiber":
      return "strand";
    case "film":
      return "film";
    case "adhesive":
    case "solid":
      return "block";
    case "clumps":
      return "clumps";
    case "dangerous":
      return "hazard";
  }
}

export function buildMixScene(experiment: Experiment, result: RunResult): MixScene {
  const species = buildSpecies(experiment);
  const phases = buildPhases(experiment, result);
  const { effects, blocked } = buildEffects(experiment, result, phases);
  let finalShape = species.length === 0 ? "empty" : shapeForProduct(result.product);
  if (
    ["gel", "slime", "solid", "film"].includes(result.product) &&
    effects.some((effect) => effect.kind === "bubbles" && effect.strength >= 0.5)
  ) {
    finalShape = "foam";
  }
  const network = finalShape === "liquid"
    ? 0
    : clamp01(effects.reduce(
        (total, effect) =>
          total + (effect.kind === "bonds" || effect.kind === "align" ? effect.strength : 0),
        0,
      ));
  const stirSpeed = clamp01(experiment.conditions.mixRpm / 2000);
  const thermal = clamp01((experiment.conditions.tempC + 20) / 220);
  const mixing = 1 - Math.exp(
    -(experiment.conditions.mixRpm * experiment.conditions.mixMinutes) / 3000,
  );
  const mixCompleteness = clamp01(Math.max(0.15, mixing) + 0.15 * thermal);
  const totalRealSeconds = phases.reduce((total, phase) => total + phase.realSeconds, 0);

  return {
    species,
    stirSpeed,
    thermal,
    mixCompleteness,
    atmosphere: experiment.conditions.atmosphere,
    boiling: getBoilingState(experiment),
    forming: experiment.conditions.forming,
    product: result.product,
    finalShape,
    network,
    phases,
    effects,
    blocked,
    totalRealSeconds,
  };
}

export function realTimeAt(scene: MixScene, t: number): number {
  const progress = clamp01(t);
  let elapsed = 0;
  for (const phase of scene.phases) {
    if (progress >= phase.end) {
      elapsed += phase.realSeconds;
      continue;
    }
    if (progress > phase.start && phase.end > phase.start) {
      elapsed += phase.realSeconds * (progress - phase.start) / (phase.end - phase.start);
    }
    break;
  }
  return elapsed;
}
