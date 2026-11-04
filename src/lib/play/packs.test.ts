import { afterEach, describe, expect, it, vi } from "vitest";
import { deletePack, loadPacks, PACKS_KEY, packId, savePack, sanitizePackContents } from "./packs";

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

const contents = {
  title: "  Starter pack ",
  author: "  Teacher ",
  quests: [
    { type: "molecule" as const, moleculeId: "ethane" },
    { type: "nucleus" as const, title: "Bound nucleus", targets: { bound: true } },
  ],
};

describe("quest packs", () => {
  it("trims and caps text and enforces quest counts", () => {
    const result = sanitizePackContents({
      title: ` ${"T".repeat(100)} `,
      author: ` ${"A".repeat(50)} `,
      quests: [{
        type: "mix",
        title: "Mix",
        story: ` ${"s".repeat(400)} `,
        hint: ` ${"h".repeat(400)} `,
        targets: { minTack: 2 },
      }],
    });
    expect(result?.pack.title).toHaveLength(80);
    expect(result?.pack.author).toHaveLength(40);
    expect(result?.pack.quests[0]).toMatchObject({
      story: "s".repeat(300),
      hint: "h".repeat(300),
    });
    expect(sanitizePackContents({ title: "Empty", quests: [] })).toBeNull();
    expect(sanitizePackContents({ title: "Too many", quests: Array(11).fill(contents.quests[0]) })).toBeNull();
  });

  it("uses stable content IDs, deduplicates saves, and deletes packs", () => {
    const storage = stubStorage();
    const first = savePack(contents, new Date("2025-01-01T00:00:00Z"))!;
    const duplicate = savePack(contents, new Date("2025-01-02T00:00:00Z"))!;
    expect(first.id).toBe(duplicate.id);
    expect(first.createdAt).toBe(duplicate.createdAt);
    expect(packId({ ...contents, author: "Another teacher" })).not.toBe(first.id);
    expect(loadPacks()).toEqual([first]);
    expect(JSON.parse(storage.getItem(PACKS_KEY)!)).toHaveLength(1);
    expect(deletePack(first.id)).toEqual([]);
    expect(loadPacks()).toEqual([]);
  });

  it("loads valid saved packs and ignores malformed entries", () => {
    const storage = stubStorage();
    const pack = savePack(contents)!;
    storage.setItem(PACKS_KEY, JSON.stringify([pack, { ...pack, id: "wrong" }, null]));
    expect(loadPacks()).toEqual([pack]);
  });

  it("accepts optional grade levels while rejecting invalid levels and preserving old packs", () => {
    const oldPack = sanitizePackContents(contents);
    expect(oldPack?.pack.level).toBeUndefined();
    expect(sanitizePackContents({ ...contents, level: "middle" })?.pack.level).toBe("middle");
    expect(sanitizePackContents({ ...contents, level: "graduate" })).toBeNull();
  });
});
