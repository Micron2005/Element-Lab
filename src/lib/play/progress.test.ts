import { afterEach, describe, expect, it, vi } from "vitest";
import { isUnlocked, loadProgress, recordStars, PROGRESS_KEY, totalStars } from "./progress";
import { QUESTS } from "./quests";

function stubStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("play progress", () => {
  it("retains the maximum star score and stores it under the play key", () => {
    const storage = stubStorage();
    expect(recordStars("molecule-hydrogen", 2).stars["molecule-hydrogen"]).toBe(2);
    expect(recordStars("molecule-hydrogen", 1).stars["molecule-hydrogen"]).toBe(2);
    expect(recordStars("molecule-hydrogen", 3).stars["molecule-hydrogen"]).toBe(3);
    expect(JSON.parse(storage.getItem(PROGRESS_KEY)!).stars["molecule-hydrogen"]).toBe(3);
    expect(totalStars(loadProgress())).toBe(3);
  });

  it("unlocks the first quest per chapter and chains later quests by one star", () => {
    stubStorage();
    const moleculeQuests = QUESTS.filter((quest) => quest.chapter === "molecules");
    const mixingQuests = QUESTS.filter((quest) => quest.chapter === "mixing");
    const progress = loadProgress();
    expect(isUnlocked(moleculeQuests[0].id, progress)).toBe(true);
    expect(isUnlocked(mixingQuests[0].id, progress)).toBe(true);
    expect(isUnlocked(moleculeQuests[1].id, progress)).toBe(false);

    const noStars = recordStars(moleculeQuests[0].id, 0);
    expect(isUnlocked(moleculeQuests[1].id, noStars)).toBe(false);
    const oneStar = recordStars(moleculeQuests[0].id, 1);
    expect(isUnlocked(moleculeQuests[1].id, oneStar)).toBe(true);
  });

  it("treats malformed saved JSON as empty progress", () => {
    stubStorage({ [PROGRESS_KEY]: "{not valid JSON" });
    expect(loadProgress()).toEqual({ stars: {} });
  });

  it("is safe during server rendering without a window", () => {
    vi.stubGlobal("window", undefined);
    expect(loadProgress()).toEqual({ stars: {} });
    expect(recordStars("molecule-hydrogen", 1).stars["molecule-hydrogen"]).toBe(1);
  });
});
