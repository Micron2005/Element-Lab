import { describe, expect, it } from "vitest";
import { ATOMS, localizeAtom } from "../play/atoms";
import { MOLECULE_LESSONS, QUEST_LESSONS } from "../play/learn";
import { KNOWN_MOLECULES } from "../play/molecule";
import { CHAPTERS, localizeChapter, QUESTS } from "../play/quests";
import { ATOM_NAMES_ES } from "./data/es/atoms";
import { MOLECULE_LESSONS_ES, QUEST_LESSONS_ES } from "./data/es/learn";
import { MOLECULE_TEXT_ES } from "./data/es/molecule";
import { CHAPTER_TEXT_ES, QUEST_TEXT_ES } from "./data/es/quests";

const placeholders = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
  .map((match) => match[1])
  .sort();
const numericAngle = (value: string) => /^[0-9.,°\s]+$/.test(value);
const angleValue = (value: string) => Number(value.replace(/[°\s]/g, "").replace(",", "."));

describe("Spanish data overlays", () => {
  it("translates every Play chapter title and blurb", () => {
    for (const chapter of CHAPTERS) {
      const overlay = CHAPTER_TEXT_ES[chapter.id];
      for (const field of ["title", "blurb"] as const) {
        const translated = overlay[field];
        expect(translated.trim(), `${chapter.id}.${field}`).toBeTruthy();
        expect(translated, `${chapter.id}.${field}`).not.toBe(chapter[field]);
        expect(placeholders(translated), `${chapter.id}.${field}`).toEqual(placeholders(chapter[field]));
        expect(localizeChapter(chapter, "es")[field]).toBe(translated);
      }
    }
  });

  it("translates every built-in atom name", () => {
    expect(Object.keys(ATOM_NAMES_ES).sort()).toEqual(Object.keys(ATOMS).sort());
    for (const [symbol, translated] of Object.entries(ATOM_NAMES_ES)) {
      expect(translated.trim()).toBeTruthy();
      expect(translated).not.toBe(ATOMS[symbol as keyof typeof ATOMS].name);
      expect(placeholders(translated)).toEqual(placeholders(ATOMS[symbol as keyof typeof ATOMS].name));
      expect(localizeAtom(ATOMS[symbol as keyof typeof ATOMS], "es").name).toBe(translated);
    }
  });

  it("covers every molecule id and keeps overlaid text complete", () => {
    const source = new Map(KNOWN_MOLECULES.map((molecule) => [molecule.id, molecule]));
    expect(Object.keys(MOLECULE_TEXT_ES).sort()).toEqual([...source.keys()].sort());

    for (const [id, overlay] of Object.entries(MOLECULE_TEXT_ES)) {
      const molecule = source.get(id as keyof typeof MOLECULE_TEXT_ES);
      expect(molecule).toBeDefined();
      for (const field of ["name", "shape", "uses", "fact", "angle", "caution"] as const) {
        const original = molecule?.[field];
        if (typeof original !== "string") continue;
        const translated = overlay[field];
        expect(translated?.trim()).toBeTruthy();
        if (field === "angle" && numericAngle(original) && numericAngle(translated ?? "")) {
          expect(angleValue(translated!)).toBe(angleValue(original));
        } else {
          expect(translated).not.toBe(original);
        }
        expect(placeholders(translated ?? "")).toEqual(placeholders(original));
      }
      for (const [field, translated] of Object.entries(overlay)) {
        expect(translated?.trim()).toBeTruthy();
        const original = molecule?.[field as keyof typeof molecule];
        if (typeof original === "string" && typeof translated === "string") {
          if (field === "angle" && numericAngle(original) && numericAngle(translated)) {
            expect(angleValue(translated)).toBe(angleValue(original));
          } else {
            expect(translated).not.toBe(original);
          }
          expect(placeholders(translated)).toEqual(placeholders(original));
        }
      }
    }
  });

  it("covers every molecule learning lesson and translates every field", () => {
    expect(Object.keys(MOLECULE_LESSONS_ES).sort()).toEqual(Object.keys(MOLECULE_LESSONS).sort());
    for (const [id, overlay] of Object.entries(MOLECULE_LESSONS_ES)) {
      const source = MOLECULE_LESSONS[id as keyof typeof MOLECULE_LESSONS];
      for (const [field, translated] of Object.entries(overlay)) {
        const original = source[field as keyof typeof source];
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

  it("covers every quest learning lesson and translates every field", () => {
    expect(Object.keys(QUEST_LESSONS_ES).sort()).toEqual(Object.keys(QUEST_LESSONS).sort());
    for (const [id, overlay] of Object.entries(QUEST_LESSONS_ES)) {
      const source = QUEST_LESSONS[id as keyof typeof QUEST_LESSONS];
      for (const [field, translated] of Object.entries(overlay)) {
        const original = source[field as keyof typeof source];
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
