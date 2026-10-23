import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS, effectivePH } from "./conditions";
import {
  CUSTOM_PREFIX,
  draftFromIngredient,
  emptyDraft,
  newCustomId,
  parseStoredCustom,
  validateCustomDraft,
} from "./custom";
import {
  allBenchIngredients,
  benchById,
  benchLibrary,
  setCustomIngredients,
} from "./library";
import { simulate } from "./simulate";
import { DEFAULT_SHOT, shootTest } from "./shootTest";
import type { BenchIngredient, Experiment } from "./types";

function ingredientFrom(overrides: Partial<ReturnType<typeof emptyDraft>> = {}): BenchIngredient {
  const draft = { ...emptyDraft(), name: "My material", density: "1.2", ...overrides };
  const result = validateCustomDraft(draft, `${CUSTOM_PREFIX}test`);
  if (!("ingredient" in result)) throw new Error(JSON.stringify(result.errors));
  return result.ingredient;
}

function experiment(parts: Experiment["parts"]): Experiment {
  return { parts, conditions: { ...DEFAULT_CONDITIONS } };
}

afterEach(() => setCustomIngredients([]));

describe("custom Bench ingredients", () => {
  it("maps selected traits to tags and builds acid/base charge data", () => {
    const polymer = ingredientFrom({
      traits: ["protein", "diol", "elastomer"],
      tensileMPa: "25",
      elongationPct: "300",
      tack: "2",
    });
    expect(polymer.tags).toEqual(["protein", "diol", "elastomer"]);
    expect(polymer.surfaceTensionNm).toBeUndefined();
    expect(polymer.volatile).toBe(false);
    expect(polymer.bonding).toBe(
      "You defined this ingredient; its molecular bonding isn't predicted.",
    );

    const acid = ingredientFrom({ acidBase: "acid", pKa: "4.76", molarMass: "60" });
    expect(acid.acidBase?.molPerPct).toBeCloseTo(10 / 60);
    expect(acid.acidBase?.pKas).toEqual([4.76]);

    const base = ingredientFrom({ acidBase: "base", pKa: "9.2", molarMass: "40" });
    expect(base.acidBase?.molPerPct).toBeCloseTo(10 / 40);
    expect(base.acidBase?.chargeProtonated).toBe(1);
  });

  it("validates required and bounded fields", () => {
    expect(validateCustomDraft(emptyDraft(), newCustomId())).toMatchObject({
      errors: { name: "Enter a name.", density: expect.any(String) },
    });
    expect(
      validateCustomDraft(
        { ...emptyDraft(), name: "Bad strength", density: "1", tensileMPa: "2000" },
        newCustomId(),
      ),
    ).toMatchObject({ errors: { tensileMPa: "Strength must be 0–1500 MPa." } });
    expect(
      validateCustomDraft(
        { ...emptyDraft(), name: "Liquid", density: "1", liquid: true },
        newCustomId(),
      ),
    ).toMatchObject({ errors: { viscosityPas: expect.any(String) } });
    expect(
      validateCustomDraft(
        { ...emptyDraft(), name: "Acid", density: "1", acidBase: "acid", molarMass: "60" },
        newCustomId(),
      ),
    ).toMatchObject({ errors: { pKa: expect.any(String) } });
    expect(
      validateCustomDraft(
        { ...emptyDraft(), name: "Acid", density: "1", acidBase: "acid", pKa: "4.76" },
        newCustomId(),
      ),
    ).toMatchObject({ errors: { molarMass: expect.any(String) } });
  });

  it("round-trips a custom ingredient through its draft", () => {
    const first = ingredientFrom({
      name: " Stretchy mix ",
      formula: "C₃H₆",
      traits: ["elastomer", "diol"],
      tensileMPa: "12",
      elongationPct: "420",
      tack: "4",
      density: "0.95",
      costPerKg: "3.5",
      notes: "A user material.",
      water: "swells",
      biodegradable: true,
    });
    const roundTrip = validateCustomDraft(draftFromIngredient(first), first.id);
    expect(roundTrip).toEqual({ ingredient: first });
  });

  it("keeps only valid, unique custom IDs from stored data", () => {
    const custom = ingredientFrom();
    const invalid = { ...custom, id: `${CUSTOM_PREFIX}invalid`, density: -1 };
    const builtin = { ...custom, id: "water" };
    expect(parseStoredCustom([
      "garbage",
      null,
      builtin,
      invalid,
      custom,
      custom,
    ])).toEqual([custom]);
    expect(parseStoredCustom({})).toEqual([]);
    expect(parseStoredCustom("[]")).toEqual([]);
  });

  it("registers custom ingredients without changing built-in entries", () => {
    const builtInCount = benchLibrary.length;
    const custom = ingredientFrom();
    setCustomIngredients([custom]);
    expect(benchById[custom.id]).toEqual(custom);
    expect(allBenchIngredients()).toContainEqual(custom);
    setCustomIngredients([]);
    expect(benchById[custom.id]).toBeUndefined();
    expect(allBenchIngredients()).toHaveLength(builtInCount);
    expect(benchLibrary).toHaveLength(builtInCount);
  });

  it("uses custom diol tags for borax crosslinking without lowering confidence", () => {
    const polymer = ingredientFrom({
      name: "Custom diol polymer",
      traits: ["diol"],
      category: "polymer",
    });
    setCustomIngredients([polymer]);
    const result = simulate(
      experiment([
        { id: polymer.id, pct: 10 },
        { id: "borax", pct: 2 },
        { id: "sodium-bicarbonate", pct: 2 },
        { id: "water", pct: 86 },
      ]),
    );
    const event = result.events.find((item) => item.id === "borax-pva");
    expect(result.effectivePH).toBeGreaterThanOrEqual(8);
    expect(event?.activity).toBeGreaterThan(0);
    expect(result.notModelled.join(" ")).not.toContain(polymer.name);
  });

  it("reports untested interactions for a no-trait custom ingredient", () => {
    const custom = ingredientFrom({ name: "Unmodeled resin", traits: [] });
    setCustomIngredients([custom]);
    const result = simulate(experiment([
      { id: custom.id, pct: 10 },
      { id: "water", pct: 90 },
    ]));
    expect(result.notModelled.join(" ")).toContain(custom.name);
    expect(result.confidence).toBeLessThan(1);
  });

  it("uses custom acid pKa and molar mass in effective pH", () => {
    const acid = ingredientFrom({
      name: "Custom acid",
      category: "acid-base",
      acidBase: "acid",
      pKa: "4.76",
      molarMass: "60",
    });
    setCustomIngredients([acid]);
    const pH = effectivePH(experiment([
      { id: acid.id, pct: 5 },
      { id: "water", pct: 95 },
    ]));
    expect(pH).toBeGreaterThan(2);
    expect(pH).toBeLessThan(4);
  });

  it("recognizes custom protein targets for transglutaminase", () => {
    const protein = ingredientFrom({
      name: "Custom protein",
      category: "protein",
      traits: ["protein"],
    });
    setCustomIngredients([protein]);
    const result = simulate(experiment([
      { id: protein.id, pct: 40 },
      { id: "water", pct: 58 },
      { id: "transglutaminase", pct: 2 },
    ]));
    expect(result.events.some((event) => event.id === "transglutaminase")).toBe(true);
    expect(result.notModelled.join(" ")).not.toContain(protein.name);
  });

  it("shoots a custom liquid mix without throwing", () => {
    const liquid = ingredientFrom({
      name: "Custom liquid",
      category: "solvent",
      liquid: true,
      viscosityPas: "0.01",
      density: "0.9",
    });
    setCustomIngredients([liquid]);
    const mix = experiment([
      { id: liquid.id, pct: 40 },
      { id: "water", pct: 60 },
    ]);
    expect(() => shootTest(mix, simulate(mix), DEFAULT_SHOT)).not.toThrow();
  });
});
