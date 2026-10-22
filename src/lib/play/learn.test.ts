import { describe, expect, it } from "vitest";
import { simulate } from "../bench/simulate";
import { KNOWN_MOLECULES } from "./molecule";
import { QUESTS } from "./quests";
import {
  MOLECULE_LESSONS,
  QUEST_LESSONS,
  atomCard,
  mixCard,
  moleculeCard,
} from "./learn";

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
    expect(happened).toContain(result.productLabel);
    expect(happened).toContain(`${event!.name} (${event!.status}): ${event!.mechanism}`);
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

    const newElement = atomCard(newElementQuest, 120, 244);
    expect(newElement.context.toLowerCase()).toContain("prediction");
    expect(() => atomCard(newElementQuest, 0, 0)).not.toThrow();
  });
});
