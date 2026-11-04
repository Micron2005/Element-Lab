import { describe, expect, it, vi } from "vitest";
import { QUESTS } from "./quests";
import { isUnlocked, type PlayProgress } from "./progress";
import {
  GRADE_LEVELS,
  QUEST_MIN_LEVEL,
  gradeLevelFromStorage,
  isGradeLevel,
  isLevelVisible,
  parseGradeLevel,
  splitQuestsByLevel,
  saveGradeLevel,
} from "./levels";
import { PREFS_KEY, savePrefs, DEFAULT_PREFS } from "../prefs";

describe("grade levels", () => {
  it("parses valid shared-link level values and defaults invalid or absent values to high", () => {
    expect(GRADE_LEVELS.map(parseGradeLevel)).toEqual(GRADE_LEVELS);
    expect(parseGradeLevel("university")).toBeNull();
    expect(gradeLevelFromStorage(null)).toBe("high");
    expect(gradeLevelFromStorage("middle")).toBe("middle");
    expect(isGradeLevel("college")).toBe(true);
    expect(isGradeLevel("primary")).toBe(false);
  });

  it("enables Beginner for middle level unless the preference was explicitly set", () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal("window", { localStorage, dispatchEvent: vi.fn() });
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    try {
      saveGradeLevel("middle");
      expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null").beginner).toBe(true);
      savePrefs({ ...DEFAULT_PREFS, beginner: false });
      saveGradeLevel("middle");
      expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null").beginner).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("has a complete typed level map and filters quests without deleting them", () => {
    expect(Object.keys(QUEST_MIN_LEVEL).sort()).toEqual(QUESTS.map(({ id }) => id).sort());
    const molecules = QUESTS.filter(({ chapter }) => chapter === "molecules");
    const middle = splitQuestsByLevel(molecules, "middle");
    expect(middle.visible.map(({ id }) => id)).toContain("molecule-water");
    expect(middle.visible.map(({ id }) => id)).not.toContain("molecule-acetic-acid");
    expect(middle.higher.map(({ id }) => id)).toContain("molecule-acetic-acid");
    expect(isLevelVisible("atom-tightest", "high")).toBe(false);
    expect(isLevelVisible("atom-tightest", "college")).toBe(true);
  });

  it("unlocks against the visible level sequence, skipping hidden higher-level quests", () => {
    const molecules = QUESTS.filter(({ chapter }) => chapter === "molecules");
    const middle = splitQuestsByLevel(molecules, "middle").visible;
    const waterIndex = middle.findIndex(({ id }) => id === "molecule-water");
    const progress: PlayProgress = { stars: { "molecule-hydrogen": 1, "molecule-water": 1 } };
    expect(middle.some(({ id }) => id === "molecule-nitrogen")).toBe(false);
    expect(isUnlocked(middle[waterIndex + 1].id, progress, middle)).toBe(true);
    expect(isUnlocked("molecule-nitrogen", progress, middle)).toBe(false);
  });
});
