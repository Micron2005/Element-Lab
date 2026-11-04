import { describe, expect, it } from "vitest";
import { benchPresets } from "./presets";
import { simulate } from "./simulate";
import { compareRuns, type CompareInput } from "./compare";
import { DEFAULT_CONDITIONS } from "./conditions";
import type { Experiment, RunResult } from "./types";

const alginate = benchPresets.find(({ id }) => id === "alginate-fiber")!.experiment;

function run(name: string, experiment: Experiment, result = simulate(experiment)): CompareInput {
  return { name, experiment, result };
}

function resultWith(overrides: Partial<RunResult> = {}): RunResult {
  return {
    product: "fiber",
    productLabel: "Fiber",
    summary: "A fiber.",
    tensileMPa: 1,
    elongationPct: 1,
    tack: 1,
    toughnessMJm3: 1,
    setSeconds: 5,
    wetToxicity: 1,
    curedToxicity: 1,
    skin: 1,
    edible: false,
    water: "resists",
    dissolveTime: "slow",
    biodegradable: false,
    costPerKg: 10,
    effectivePH: 7,
    events: [],
    warnings: [],
    notModelled: [],
    confidence: 0.8,
    ...overrides,
  };
}

function measure(result: ReturnType<typeof compareRuns>, label: string) {
  return result.measures.find((item) => item.label === label)!;
}

describe("bench run comparison", () => {
  it("localizes comparison explanations to Spanish", () => {
    const withoutBath: Experiment = {
      parts: alginate.parts,
      conditions: { ...alginate.conditions, forming: "beaker", bathId: undefined },
    };
    const comparison = compareRuns([
      run("Con baño", alginate),
      run("Sin baño", withoutBath),
    ], "es");
    expect(comparison.why.join(" ")).toContain("pasó de ocurrió a");
  });

  it("explains the alginate-calcium change when removing the bath", () => {
    const withoutBath: Experiment = {
      parts: alginate.parts,
      conditions: { ...alginate.conditions, forming: "beaker", bathId: undefined },
    };
    const comparison = compareRuns([
      run("With bath", alginate),
      run("Without bath", withoutBath),
    ]);
    expect(comparison.reactions.some((reaction) =>
      reaction.name.toLowerCase().includes("alginate") &&
      reaction.statuses[0] !== reaction.statuses[1],
    )).toBe(true);
    expect(comparison.why.join(" ")).toMatch(/calcium/i);
    expect(comparison.why.join(" ")).toMatch(/alginate/i);
  });

  it("explains absent reactions as not possible when an ingredient is missing", () => {
    const withoutAlginate: Experiment = {
      parts: alginate.parts.filter(({ id }) => id !== "alginate"),
      conditions: { ...alginate.conditions },
    };
    const comparison = compareRuns([
      run("Run A", alginate),
      run("Run B", withoutAlginate),
    ]);
    const reaction = comparison.reactions.find(({ name }) => name.includes("Alginate"))!;

    expect(reaction.statuses).toEqual(["happened", "absent"]);
    expect(comparison.why).toContain(
      `Run B: ${reaction.name} went from happened to not possible (an ingredient is missing).`,
    );
  });

  it("unions ingredients from three runs and marks missing ingredients null", () => {
    const withChitosan: Experiment = {
      parts: [...alginate.parts, { id: "chitosan", pct: 3 }],
      conditions: { ...alginate.conditions },
    };
    const withBoric: Experiment = {
      parts: [...alginate.parts, { id: "borax", pct: 2 }],
      conditions: { ...alginate.conditions },
    };
    const comparison = compareRuns([
      run("A", alginate),
      run("B", withChitosan),
      run("C", withBoric),
    ]);
    expect(comparison.ingredients.map(({ id }) => id)).toEqual(["alginate", "water", "chitosan", "borax"]);
    expect(comparison.ingredients.find(({ id }) => id === "chitosan")?.pcts).toEqual([null, 3, null]);
    expect(comparison.ingredients.find(({ id }) => id === "borax")?.pcts).toEqual([null, null, 2]);
  });

  it("selects the highest strength and returns per-run deltas", () => {
    const comparison = compareRuns([
      run("A", { parts: [], conditions: DEFAULT_CONDITIONS }, resultWith({ tensileMPa: 0.4 })),
      run("B", { parts: [], conditions: DEFAULT_CONDITIONS }, resultWith({ tensileMPa: 5.4 })),
    ]);
    expect(measure(comparison, "Strength").best).toBe(1);
    expect(measure(comparison, "Strength").deltas).toEqual(["—", "+5.0 MPa"]);
  });

  it("leaves best null on ties and for non-solid products", () => {
    const experiment = { parts: [], conditions: DEFAULT_CONDITIONS };
    const tied = compareRuns([
      run("A", experiment, resultWith({ tensileMPa: 5 })),
      run("B", experiment, resultWith({ tensileMPa: 5 })),
    ]);
    expect(measure(tied, "Strength").best).toBeNull();

    const nonSolid = compareRuns([
      run("A", experiment, resultWith({ product: "solution", tensileMPa: 10 })),
      run("B", experiment, resultWith({ tensileMPa: 5 })),
    ]);
    expect(measure(nonSolid, "Strength").best).toBeNull();
    expect(measure(nonSolid, "Strength").deltas[1]).toBe("—");
  });

  it("selects the lowest cost", () => {
    const experiment = { parts: [], conditions: DEFAULT_CONDITIONS };
    const comparison = compareRuns([
      run("A", experiment, resultWith({ costPerKg: 10 })),
      run("B", experiment, resultWith({ costPerKg: 5 })),
      run("C", experiment, resultWith({ costPerKg: 7 })),
    ]);
    expect(measure(comparison, "Cost").best).toBe(1);
  });

  it("chooses best among solid runs and requires at least two solid candidates", () => {
    const experiment = { parts: [], conditions: DEFAULT_CONDITIONS };
    const nonSolid = resultWith({
      product: "solution",
      tensileMPa: 100,
      elongationPct: 100,
      toughnessMJm3: 100,
      costPerKg: 0,
      wetToxicity: 0,
      curedToxicity: 0,
      skin: 0,
      confidence: 1,
    });
    const stronger = resultWith({
      tensileMPa: 10,
      elongationPct: 10,
      toughnessMJm3: 10,
      costPerKg: 20,
      wetToxicity: 2,
      curedToxicity: 1,
      skin: 1,
      confidence: 0.8,
    });
    const safer = resultWith({
      tensileMPa: 5,
      elongationPct: 5,
      toughnessMJm3: 5,
      costPerKg: 25,
      wetToxicity: 1,
      curedToxicity: 1,
      skin: 1,
      confidence: 0.9,
    });
    const comparison = compareRuns([
      run("Solution", experiment, nonSolid),
      run("Stronger", experiment, stronger),
      run("Safer", experiment, safer),
    ]);

    expect(measure(comparison, "Strength").best).toBe(1);
    expect(measure(comparison, "Stretch").best).toBe(1);
    expect(measure(comparison, "Toughness").best).toBe(1);
    expect(measure(comparison, "Cost").best).toBe(1);
    expect(measure(comparison, "Safety (wet / cured / skin)").best).toBe(2);
    expect(measure(comparison, "Confidence").best).toBe(2);

    const oneSolid = compareRuns([
      run("Solution", experiment, nonSolid),
      run("Solid", experiment, stronger),
    ]);
    for (const label of ["Strength", "Stretch", "Toughness", "Cost", "Safety (wet / cured / skin)", "Confidence"]) {
      expect(measure(oneSolid, label).best).toBeNull();
    }
  });

  it("uses the exact no-differences message for identical runs", () => {
    expect(compareRuns([run("A", alginate), run("B", alginate)]).why).toEqual([
      "No differences: same ingredients and conditions.",
    ]);
  });

  it("requires two or three runs", () => {
    const input = run("A", alginate);
    expect(() => compareRuns([input])).toThrow();
    expect(() => compareRuns([input, input, input, input])).toThrow();
  });
});
