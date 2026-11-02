import { afterEach, describe, expect, it, vi } from "vitest";
import { benchPresets } from "../bench/presets";
import { simulate } from "../bench/simulate";
import { KNOWN_MOLECULES } from "./molecule";
import { QUESTS, gradeMolecule } from "./quests";
import {
  DAILY_POOL,
  DAILY_PROGRESS_KEY,
  dailyFor,
  dailyKey,
  loadDailyProgress,
  recordDaily,
  streak,
} from "./daily";
import { compileTemplate } from "./templates";

function stubStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

afterEach(() => vi.unstubAllGlobals());

describe("daily challenges", () => {
  it("contains eight unused molecules, nine mix challenges, and four nucleus challenges", () => {
    expect(DAILY_POOL).toHaveLength(21);
    expect(DAILY_POOL.filter(({ type }) => type === "molecule")).toHaveLength(8);
    expect(DAILY_POOL.filter(({ type }) => type === "mix")).toHaveLength(9);
    expect(DAILY_POOL.filter(({ type }) => type === "nucleus")).toHaveLength(4);
    const used = new Set(QUESTS.filter((quest) => quest.chapter === "molecules").map((quest) => quest.moleculeId));
    for (const template of DAILY_POOL.filter((item) => item.type === "molecule")) {
      expect(KNOWN_MOLECULES.some((molecule) => molecule.id === template.moleculeId)).toBe(true);
      expect(used.has(template.moleculeId)).toBe(false);
      const molecule = KNOWN_MOLECULES.find(({ id }) => id === template.moleculeId)!;
      const quest = compileTemplate("daily:test", template);
      if (quest.chapter !== "molecules") throw new Error("Expected a molecule quest.");
      expect(gradeMolecule(quest, molecule.graph, 0).stars).toBe(3);
    }
  });

  it("keeps reference solutions for every mix and nucleus template", () => {
    const mixPresetIds = [
      "alginate-fiber",
      "chitosan-film",
      "mussel-glue",
      "baking-soda-vinegar",
      "enzyme-gelatin",
      "vulcanized-latex",
      "spider-web",
      "borax-slime",
      "enzyme-breaks-gel",
    ];
    const mixes = DAILY_POOL.filter((template) => template.type === "mix");
    expect(mixPresetIds).toHaveLength(mixes.length);
    for (let i = 0; i < mixes.length; i += 1) {
      const template = mixes[i];
      if (template.type !== "mix") throw new Error("Expected a mix template.");
      const preset = benchPresets.find(({ id }) => id === mixPresetIds[i])!;
      const quest = compileTemplate(`daily:mix-${i}`, template);
      if (quest.chapter !== "mixing") throw new Error("Expected a mix quest.");
      expect(quest.grade(preset.experiment, simulate(preset.experiment)).stars, template.title).toBe(3);
    }

    const nucleusSolutions: [number, number][] = [[26, 30], [114, 184], [92, 146], [2, 2]];
    const nuclei = DAILY_POOL.filter((template) => template.type === "nucleus");
    expect(nucleusSolutions).toHaveLength(nuclei.length);
    for (let i = 0; i < nuclei.length; i += 1) {
      const template = nuclei[i];
      if (template.type !== "nucleus") throw new Error("Expected a nucleus template.");
      const quest = compileTemplate(`daily:nucleus-${i}`, template);
      if (quest.chapter !== "atoms") throw new Error("Expected an atom quest.");
      expect(quest.grade(...nucleusSolutions[i]).stars, template.title).toBe(3);
    }
  });

  it("uses a local date key and avoids repeating yesterday's pool index", () => {
    expect(dailyKey(new Date(2025, 0, 2, 23, 59))).toBe("2025-01-02");
    const today = dailyFor("2025-01-02");
    const yesterday = dailyFor("2025-01-01");
    expect(today.id).toBe("daily:2025-01-02");
    expect(DAILY_POOL.indexOf(today.template)).not.toBe(DAILY_POOL.indexOf(yesterday.template));
    expect(dailyFor("2025-01-02").template).toBe(today.template);
  });

  it("stores the maximum daily score and ignores malformed progress", () => {
    const storage = stubStorage();
    expect(recordDaily("2025-02-01", 2).done["2025-02-01"]).toBe(2);
    expect(recordDaily("2025-02-01", 1).done["2025-02-01"]).toBe(2);
    expect(recordDaily("2025-02-01", 3).done["2025-02-01"]).toBe(3);
    expect(JSON.parse(storage.getItem(DAILY_PROGRESS_KEY)!).done["2025-02-01"]).toBe(3);
    storage.setItem(DAILY_PROGRESS_KEY, "{bad JSON");
    expect(loadDailyProgress()).toEqual({ done: {} });
  });

  it("counts streaks across month and year boundaries and stops at gaps", () => {
    expect(streak({
      "2024-12-30": 1,
      "2024-12-31": 2,
      "2025-01-01": 1,
    }, "2025-01-01")).toBe(3);
    expect(streak({
      "2025-02-28": 1,
      "2025-03-01": 2,
    }, "2025-03-02")).toBe(2);
    expect(streak({
      "2025-03-01": 1,
      "2025-03-03": 1,
    }, "2025-03-03")).toBe(1);
    expect(streak({ "2025-03-02": 1 }, "2025-03-03")).toBe(1);
  });
});
