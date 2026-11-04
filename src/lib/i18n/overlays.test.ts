import { describe, expect, it } from "vitest";
import { KNOWN_MOLECULES } from "../play/molecule";
import { QUESTS } from "../play/quests";
import { MOLECULE_TEXT_ES } from "./data/es/molecule";
import { QUEST_TEXT_ES } from "./data/es/quests";

const placeholders = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
  .map((match) => match[1])
  .sort();

describe("Spanish data overlays", () => {
  it("covers every molecule id and keeps overlaid text complete", () => {
    const source = new Map(KNOWN_MOLECULES.map((molecule) => [molecule.id, molecule]));
    expect(Object.keys(MOLECULE_TEXT_ES).sort()).toEqual([...source.keys()].sort());

    for (const [id, overlay] of Object.entries(MOLECULE_TEXT_ES)) {
      const molecule = source.get(id as keyof typeof MOLECULE_TEXT_ES);
      expect(molecule).toBeDefined();
      for (const [field, translated] of Object.entries(overlay)) {
        expect(translated?.trim()).toBeTruthy();
        const original = molecule?.[field as keyof typeof molecule];
        if (typeof original === "string" && typeof translated === "string") {
          expect(translated).not.toBe(original);
          expect(placeholders(translated)).toEqual(placeholders(original));
        }
      }
    }
  });

  it("covers every built-in quest id and translates every overlaid field", () => {
    const source = new Map(QUESTS.map((quest) => [quest.id, quest]));
    expect(Object.keys(QUEST_TEXT_ES).sort()).toEqual([...source.keys()].sort());

    for (const [id, overlay] of Object.entries(QUEST_TEXT_ES)) {
      const quest = source.get(id as keyof typeof QUEST_TEXT_ES);
      expect(quest).toBeDefined();
      for (const field of ["title", "story", "goal", "hint", "learn", "starGoals"] as const) {
        const translated = overlay[field];
        const original = quest?.[field];
        if (Array.isArray(translated) && Array.isArray(original)) {
          expect(translated).toHaveLength(original.length);
          translated.forEach((value, index) => {
            expect(value.trim()).toBeTruthy();
            expect(value).not.toBe(original[index]);
            expect(placeholders(value)).toEqual(placeholders(original[index]));
          });
        } else if (typeof translated === "string" && typeof original === "string") {
          expect(translated.trim()).toBeTruthy();
          expect(translated).not.toBe(original);
          expect(placeholders(translated)).toEqual(placeholders(original));
        }
      }
    }
  });
});
