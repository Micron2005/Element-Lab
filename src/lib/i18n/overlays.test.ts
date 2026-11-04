import { describe, expect, it } from "vitest";
import { benchLibrary, localizeBenchIngredient } from "../bench/library";
import { benchPresets, localizeBenchPreset } from "../bench/presets";
import { localizeReaction, localizeReactionEvent, REACTIONS } from "../bench/reactions";
import { byId, INGREDIENTS, localizeIngredient } from "../ingredients";
import { ATOMS, localizeAtom } from "../play/atoms";
import { MOLECULE_LESSONS, QUEST_LESSONS } from "../play/learn";
import { KNOWN_MOLECULES } from "../play/molecule";
import { CHAPTERS, localizeChapter, QUESTS } from "../play/quests";
import { ATOM_NAMES_ES } from "./data/es/atoms";
import { MOLECULE_LESSONS_ES, QUEST_LESSONS_ES } from "./data/es/learn";
import { MOLECULE_TEXT_ES } from "./data/es/molecule";
import { CHAPTER_TEXT_ES, QUEST_TEXT_ES } from "./data/es/quests";
import { BENCH_LIBRARY_TEXT_ES } from "./data/es/benchLibrary";
import { BENCH_PRESET_TEXT_ES } from "./data/es/benchPresets";
import { REACTION_TEXT_ES } from "./data/es/benchReactions";
import { INGREDIENT_TEXT_ES } from "./data/es/ingredients";
import { ELEMENT_NAMES_ES } from "./data/es/elements";
import { ELEMENT_NAMES_EN } from "./data/en/elements";
import { localizeElementName } from "../nuclear";

const placeholders = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
  .map((match) => match[1])
  .sort();
const identicalSpanishTerms = new Set(["hfip.name", "sorbitol.name"]);
const numericAngle = (value: string) => /^[0-9.,°\s]+$/.test(value);
const angleValue = (value: string) => Number(value.replace(/[°\s]/g, "").replace(",", "."));

describe("Spanish data overlays", () => {
  it("covers every Lab ingredient text field", () => {
    expect(Object.keys(INGREDIENT_TEXT_ES).sort()).toEqual(INGREDIENTS.map(({ id }) => id).sort());
    for (const source of INGREDIENTS) {
      const localized = localizeIngredient(source, "es");
      expect(localized.id).toBe(source.id);
      expect(localized.formula).toBe(source.formula);
      for (const field of ["name", "bonding", "notes"] as const) {
        expect(localized[field].trim(), `${source.id}.${field}`).toBeTruthy();
        if (localized[field] === source[field]) {
          expect(identicalSpanishTerms.has(`${source.id}.${field}`), `${source.id}.${field}`).toBe(true);
        }
        expect(placeholders(localized[field]), `${source.id}.${field}`).toEqual(placeholders(source[field]));
      }
    }
  });

  it("covers every Bench ingredient display field and leaves custom values untouched", () => {
    const addedIds = benchLibrary.filter(({ id }) => !byId[id]).map(({ id }) => id).sort();
    expect(Object.keys(BENCH_LIBRARY_TEXT_ES).sort()).toEqual(addedIds);
    for (const source of benchLibrary) {
      const localized = localizeBenchIngredient(source, "es");
      expect(localized.id).toBe(source.id);
      expect(localized.formula).toBe(source.formula);
      for (const field of ["name", "bonding", "notes"] as const) {
        expect(localized[field].trim(), `${source.id}.${field}`).toBeTruthy();
        if (localized[field] === source[field]) {
          expect(identicalSpanishTerms.has(`${source.id}.${field}`), `${source.id}.${field}`).toBe(true);
        }
        expect(placeholders(localized[field]), `${source.id}.${field}`).toEqual(placeholders(source[field]));
      }
    }
    const custom = { ...benchLibrary[0], id: "custom-user", name: "Mi ingrediente", notes: "Notas del usuario" };
    expect(localizeBenchIngredient(custom, "es")).toBe(custom);
  });

  it("covers every Bench preset name", () => {
    expect(Object.keys(BENCH_PRESET_TEXT_ES).sort()).toEqual(benchPresets.map(({ id }) => id).sort());
    for (const source of benchPresets) {
      const localized = localizeBenchPreset(source, "es");
      const translated = localized.name;
      expect(localized.id).toBe(source.id);
      expect(localized.experiment.parts).toEqual(source.experiment.parts);
      expect(translated.trim(), `${source.id}.name`).toBeTruthy();
      expect(translated, `${source.id}.name`).not.toBe(source.name);
      expect(placeholders(translated), `${source.id}.name`).toEqual(placeholders(source.name));
    }
  });

  it("covers every reaction name, mechanism, and note without changing ids", () => {
    expect(Object.keys(REACTION_TEXT_ES).sort()).toEqual(REACTIONS.map(({ id }) => id).sort());
    for (const source of REACTIONS) {
      const localized = localizeReaction(source, "es");
      expect(localized.id).toBe(source.id);
      for (const field of ["name", "mechanism"] as const) {
        expect(localized[field].trim(), `${source.id}.${field}`).toBeTruthy();
        expect(localized[field], `${source.id}.${field}`).not.toBe(source[field]);
        expect(placeholders(localized[field]), `${source.id}.${field}`).toEqual(placeholders(source[field]));
      }
      if (source.effects.note) {
        expect(localized.effects.note).toBeTruthy();
        expect(localized.effects.note).not.toBe(source.effects.note);
        expect(placeholders(localized.effects.note!), `${source.id}.effects.note`).toEqual(placeholders(source.effects.note));
      }
    }
  });

  it("localizes reaction event text without changing status identifiers", () => {
    const event = {
      id: "alginate-calcium",
      name: "Alginate–calcium",
      mechanism: REACTIONS.find(({ id }) => id === "alginate-calcium")!.mechanism,
      reasons: ["effective pH 5.0 is near the edge of the pH 4–10 alginate crosslink window"],
      status: "partial",
    };
    const localized = localizeReactionEvent(event, "es");
    expect(localized.id).toBe(event.id);
    expect(localized.status).toBe(event.status);
    expect(localized.name).toBe(REACTION_TEXT_ES["alginate-calcium"].name);
    expect(localized.reasons[0]).toContain("5,0");
    expect(localized.reasons[0]).not.toContain("effective pH");
  });

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

  it("covers all 118 Spanish element names and localizes hypothetical labels", () => {
    expect(Object.keys(ELEMENT_NAMES_ES).map(Number).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 118 }, (_, index) => index + 1));
    expect(ELEMENT_NAMES_EN).toHaveLength(118);
    for (const [atomicNumber, translated] of Object.entries(ELEMENT_NAMES_ES)) {
      const english = ELEMENT_NAMES_EN[Number(atomicNumber) - 1];
      expect(translated.trim(), atomicNumber).toBeTruthy();
      if (translated === english) {
        expect(atomicNumber, "only Zinc is identical in English and Spanish").toBe("30");
      }
      expect(localizeElementName(Number(atomicNumber), "es")).toBe(translated);
    }
    expect(localizeElementName(120, "es")).toBe("Unbinilio");
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
