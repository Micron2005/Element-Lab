import type { BuiltinQuestId } from "../i18n/data/es/quests";
import { enableBeginnerDefaultIfUnset } from "../prefs";

export type GradeLevel = "middle" | "high" | "college";

export const GRADE_LEVELS: readonly GradeLevel[] = ["middle", "high", "college"];
export const GRADE_LEVEL_KEY = "elementlab.level";
export const GRADE_LEVEL_CHANGE_EVENT = "elementlab:grade-level";

export const QUEST_MIN_LEVEL: Record<BuiltinQuestId, GradeLevel> = {
  "molecule-hydrogen": "middle",
  "molecule-water": "middle",
  "molecule-oxygen": "middle",
  "molecule-carbon-dioxide": "middle",
  "molecule-methane": "middle",
  "molecule-ammonia": "middle",
  "molecule-nitrogen": "high",
  "molecule-hydrogen-peroxide": "high",
  "molecule-ethylene": "high",
  "molecule-hydrogen-cyanide": "high",
  "molecule-ethanol": "high",
  "molecule-acetic-acid": "high",
  "mix-fizz": "middle",
  "mix-slime": "middle",
  "mix-vanishing-film": "high",
  "mix-sticky-situation": "high",
  "mix-strand": "high",
  "mix-enzyme-helper": "high",
  "atom-split": "high",
  "atom-tightest": "college",
  "atom-alpha": "high",
  "atom-new-element": "college",
};

const LEVEL_ORDER: Record<GradeLevel, number> = { middle: 0, high: 1, college: 2 };

export function isGradeLevel(value: unknown): value is GradeLevel {
  return value === "middle" || value === "high" || value === "college";
}

export function parseGradeLevel(value: unknown): GradeLevel | null {
  return isGradeLevel(value) ? value : null;
}

export function gradeLevelFromStorage(raw: string | null): GradeLevel {
  return parseGradeLevel(raw) ?? "high";
}

export function levelForQuest(id: string): GradeLevel {
  return QUEST_MIN_LEVEL[id as BuiltinQuestId] ?? "middle";
}

export function isLevelVisible(id: string, level: GradeLevel): boolean {
  return LEVEL_ORDER[levelForQuest(id)] <= LEVEL_ORDER[level];
}

export function splitQuestsByLevel<T extends { id: string }>(
  quests: readonly T[],
  level: GradeLevel,
): { visible: T[]; higher: T[] } {
  return {
    visible: quests.filter(({ id }) => isLevelVisible(id, level)),
    higher: quests.filter(({ id }) => !isLevelVisible(id, level)),
  };
}

export function loadGradeLevel(): GradeLevel {
  if (typeof window === "undefined") return "high";
  try {
    return gradeLevelFromStorage(window.localStorage.getItem(GRADE_LEVEL_KEY));
  } catch {
    return "high";
  }
}

export function saveGradeLevel(level: GradeLevel): void {
  if (!isGradeLevel(level) || typeof window === "undefined") return;
  if (level === "middle") enableBeginnerDefaultIfUnset();
  try {
    window.localStorage.setItem(GRADE_LEVEL_KEY, level);
  } catch {
    // Keep the displayed selection usable when storage is unavailable.
  }
  window.dispatchEvent(new Event(GRADE_LEVEL_CHANGE_EVENT));
}
