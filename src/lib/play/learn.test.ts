import { describe, expect, it } from "vitest";
import { simulate } from "../bench/simulate";
import { KNOWN_MOLECULES } from "./molecule";
import { QUESTS } from "./quests";
import {
  MOLECULE_LESSONS,
  LESSON_DEPTH,
  QUEST_LESSONS,
  atomCard,
  mixCard,
  moleculeCard,
} from "./learn";
import { LESSON_DEPTH_ES, MOLECULE_LESSONS_ES, QUEST_LESSONS_ES } from "../i18n/data/es/learn";
import { benchPresets } from "../bench/presets";
import { compileTemplate } from "./templates";

describe("learning cards", () => {
  it("has complete, nonempty lessons for every known molecule and mixing or atom quest", () => {
    expect(Object.keys(MOLECULE_LESSONS).sort()).toEqual(
      KNOWN_MOLECULES.map((molecule) => molecule.id).sort(),
    );
    expect(Object.keys(QUEST_LESSONS).sort()).toEqual(
      QUESTS.filter((quest) => quest.chapter !== "molecules")
        .map((quest) => quest.id)
        .sort(),
    );

    for (const lesson of [...Object.values(MOLECULE_LESSONS), ...Object.values(QUEST_LESSONS)]) {
      expect(lesson.usedFor.length).toBeGreaterThanOrEqual(3);
      expect(lesson.usedFor.length).toBeLessThanOrEqual(5);
      for (const value of Object.values(lesson)) {
        if (Array.isArray(value)) {
          expect(value.every((item) => item.trim().length > 0)).toBe(true);
        } else {
          expect(value.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("has authored, unique depth for every lesson in English and Spanish", () => {
    const ids = [...Object.keys(MOLECULE_LESSONS), ...Object.keys(QUEST_LESSONS)].sort();
    expect(Object.keys(LESSON_DEPTH).sort()).toEqual(ids);
    expect(Object.keys(LESSON_DEPTH_ES).sort()).toEqual(ids);
    const englishDeeper = Object.values(LESSON_DEPTH).map(({ deeper }) => deeper);
    const spanishDeeper = Object.values(LESSON_DEPTH_ES).map(({ deeper }) => deeper);
    expect(new Set(englishDeeper).size).toBe(ids.length);
    expect(new Set(spanishDeeper).size).toBe(ids.length);
    for (const id of Object.keys(MOLECULE_LESSONS) as (keyof typeof MOLECULE_LESSONS)[]) {
      const enFirst = MOLECULE_LESSONS[id].whatItIs.trim().split(/(?<=[.!?])\s+/)[0];
      const esFirst = MOLECULE_LESSONS_ES[id].whatItIs.trim().split(/(?<=[.!?])\s+/)[0];
      expect(LESSON_DEPTH[id].simple).not.toBe(enFirst);
      expect(LESSON_DEPTH_ES[id].simple).not.toBe(esFirst);
    }
    for (const id of Object.keys(QUEST_LESSONS) as (keyof typeof QUEST_LESSONS)[]) {
      const enFirst = QUEST_LESSONS[id].whatItIs.trim().split(/(?<=[.!?])\s+/)[0];
      const esFirst = QUEST_LESSONS_ES[id].whatItIs.trim().split(/(?<=[.!?])\s+/)[0];
      expect(LESSON_DEPTH[id].simple).not.toBe(enFirst);
      expect(LESSON_DEPTH_ES[id].simple).not.toBe(esFirst);
    }
    for (const depth of [...Object.values(LESSON_DEPTH), ...Object.values(LESSON_DEPTH_ES)]) {
      expect(depth.simple.trim()).not.toBe("");
      expect(depth.deeper.trim()).not.toBe("");
      expect(depth.simple.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
      expect(depth.deeper.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(2);
      expect(depth.deeper.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(4);
    }
  });

  it("keeps quest explanations in real-world terms", () => {
    const appLanguage = /\bmodel\b|simulat|this quest/i;
    for (const quest of QUESTS) {
      let card;
      if (quest.chapter === "mixing") {
        card = mixCard(quest, quest.reference, simulate(quest.reference));
      } else if (quest.chapter === "atoms") {
        card = atomCard(quest, quest.reference.z, quest.reference.n);
      } else {
        continue;
      }
      const explanatoryText = [
        ...card.sections
          .filter((section) => section.heading !== "What happened in your run")
          .map((section) => section.body),
        ...card.usedFor,
      ].join("\n");
      expect(explanatoryText).not.toMatch(appLanguage);
      expect(card.askPrompt).toBe(QUEST_LESSONS[quest.id as keyof typeof QUEST_LESSONS].askPrompt);
    }
  });

  it("builds the water card with its sections and uses in context", () => {
    const water = KNOWN_MOLECULES.find((molecule) => molecule.id === "water");
    expect(water).toBeDefined();
    const card = moleculeCard(water!);
    expect(card.sections.map((section) => section.heading)).toEqual([
      "What it is",
      "Why it's shaped like this",
      "What it does",
      "Why it matters",
    ]);
    expect(card.context).toContain("Water");
    expect(card.context).toContain(card.usedFor[0]);
    expect(card.askPrompt).toContain("water's bonds");
    expect(card.askPrompt).not.toContain("Water's bonds");
  });

  it("localizes the water learning card to Spanish", () => {
    const water = KNOWN_MOLECULES.find((molecule) => molecule.id === "water");
    if (!water) throw new Error("Water molecule is missing.");
    const card = moleculeCard(water, "es");
    expect(card.title).toBe("Agua (H₂O)");
    expect(card.sections[0]?.heading).toBe("Qué es");
    expect(card.sections[1]?.body).toContain("pares solitarios");
  });

  it("localizes run-derived mix and atom learning copy", () => {
    const mixQuest = QUESTS.find((item) => item.id === "mix-fizz");
    const splitQuest = QUESTS.find((item) => item.id === "atom-split");
    if (!mixQuest || mixQuest.chapter !== "mixing") throw new Error("Mix fizz quest is missing.");
    if (!splitQuest || splitQuest.chapter !== "atoms") throw new Error("Atom-split quest is missing.");

    const mixResult = simulate(mixQuest.reference, "es");
    const mix = mixCard(mixQuest, mixQuest.reference, mixResult, "es");
    const mixDetails = mix.sections.find((section) => section.heading === "Qué pasó en tu prueba")?.body ?? "";
    expect(mixDetails).toContain("Ingredientes de esta prueba:");
    expect(mixDetails).toContain("pH efectivo:");
    expect(mixDetails).not.toContain("Ingredients in this run:");

    const atom = atomCard(splitQuest, 92, 143, "es");
    const atomDetails = atom.sections.find((section) => section.heading === "Qué pasó en tu prueba")?.body ?? "";
    expect(atomDetails).toContain("Vida media estimada:");
    expect(atomDetails).toContain("Impacto de neutrón:");
    expect(atomDetails).not.toContain("Estimated half-life:");
    expect(atomDetails).not.toContain("Neutron hit:");
  });

  it("uses the fizz event and product label from the simulated mix run", () => {
    const quest = QUESTS.find((item) => item.id === "mix-fizz");
    if (!quest || quest.chapter !== "mixing") throw new Error("Mix fizz quest is missing.");
    const result = simulate(quest.reference);
    const event = result.events.find((item) => item.id === "bicarbonate-bubbles");
    expect(event).toBeDefined();
    const card = mixCard(quest, quest.reference, result);
    const happened = card.sections.find(
      (section) => section.heading === "What happened in your run",
    )?.body ?? "";
    expect(card.sections[0].body).not.toContain("Ingredients in this run:");
    expect(happened.startsWith("Ingredients in this run:")).toBe(true);
    expect(happened).toContain(result.productLabel);
    expect(happened).toContain(`${event!.name} (${event!.status}): ${event!.mechanism}`);
  });

  it("builds generic learning cards for generated mix and nucleus goals", () => {
    const mixTemplate = {
      type: "mix" as const,
      title: "A fiber quest",
      targets: { minStrengthMPa: 5, mustInclude: ["alginate"] },
    };
    const preset = benchPresets.find(({ id }) => id === "alginate-fiber")!;
    const result = simulate(preset.experiment);
    for (const id of ["daily:mix", "weekly:adhesive", "pack:sample:0"]) {
      const mixQuest = compileTemplate(id, mixTemplate);
      if (mixQuest.chapter !== "mixing") throw new Error("Expected a mix quest.");
      const materialCard = mixCard(mixQuest, preset.experiment, result);
      const runDetails = materialCard.sections.find((section) => section.heading === "What happened in your run")?.body ?? "";
      expect(materialCard.simple).toContain(result.productLabel);
      expect(materialCard.simple).not.toMatch(/acid|bicarbonate|fizz/i);
      expect(materialCard.deeper).not.toMatch(/acid|bicarbonate|fizz/i);
      expect(materialCard.sections.find((section) => section.heading === "What it does")?.body).toContain("Strength at least 5 MPa");
      expect(runDetails).toContain(result.productLabel);
      expect(runDetails).toContain(result.summary);
      expect(runDetails).toContain("Safety:");
      expect(runDetails).toContain("Effective pH:");
      for (const event of result.events) {
        expect(runDetails).not.toContain(event.name);
        expect(runDetails).not.toContain(event.mechanism);
      }
    }

    const atomQuest = compileTemplate("daily:nucleus", {
      type: "nucleus",
      title: "A superheavy nucleus",
      targets: { minZ: 114, bound: true },
    });
    if (atomQuest.chapter !== "atoms") throw new Error("Expected an atom quest.");
    const nucleusCard = atomCard(atomQuest, 114, 184);
    expect(nucleusCard.sections.find((section) => section.heading === "What it does")?.body).toContain("Proton count Z at least 114");
    expect(nucleusCard.sections.find((section) => section.heading === "What happened in your run")?.body).toContain("Z=114");
  });

  it("includes the fission event details and flags hypothetical elements as predictions", () => {
    const splitQuest = QUESTS.find((item) => item.id === "atom-split");
    const newElementQuest = QUESTS.find((item) => item.id === "atom-new-element");
    if (!splitQuest || splitQuest.chapter !== "atoms") throw new Error("Atom-split quest is missing.");
    if (!newElementQuest || newElementQuest.chapter !== "atoms") {
      throw new Error("New-element quest is missing.");
    }

    const split = atomCard(splitQuest, 92, 143);
    const happened = split.sections.find(
      (section) => section.heading === "What happened in your run",
    )?.body ?? "";
    expect(happened).toContain("MeV");
    expect(happened.toLowerCase()).toContain("fission");
    expect(happened.trim()).toMatch(/rough liquid-drop estimates, not measurements\.$/);

    const newElement = atomCard(newElementQuest, 120, 244);
    expect(newElement.context.toLowerCase()).toContain("prediction");
    const newElementHappened = newElement.sections.find(
      (section) => section.heading === "What happened in your run",
    )?.body ?? "";
    expect(newElementHappened.trim()).toMatch(
      /rough liquid-drop estimates, and a model nucleus is a prediction, not a real element\.$/,
    );
    expect(() => atomCard(newElementQuest, 0, 0)).not.toThrow();
  });
});
