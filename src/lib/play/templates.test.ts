import { describe, expect, it } from "vitest";
import { benchPresets } from "../bench/presets";
import { simulate } from "../bench/simulate";
import { analyzeNucleus } from "../nuclear";
import { KNOWN_MOLECULES } from "./molecule";
import { gradeMolecule } from "./quests";
import { compileTemplate, describeTargets } from "./templates";

describe("quest templates", () => {
  it("compiles molecule templates through the existing molecule grader", () => {
    const template = { type: "molecule" as const, moleculeId: "water" };
    const quest = compileTemplate("daily:2025-01-01", template);
    const water = KNOWN_MOLECULES.find(({ id }) => id === "water")!;

    expect(quest.title).toBe("Build Water");
    expect(quest.chapter).toBe("molecules");
    if (quest.chapter !== "molecules") throw new Error("Expected a molecule quest.");
    expect(quest.palette).toEqual(["O", "H"]);
    expect(quest.moleculeId).toBe("water");
    expect(gradeMolecule(quest, water.graph, 0).stars).toBe(3);
    expect(gradeMolecule(quest, water.graph, 1).stars).toBe(2);
  });

  it("grades mix goals with the model and rejects mechanical minimums for non-solids", () => {
    const preset = benchPresets.find(({ id }) => id === "alginate-fiber")!;
    const template = {
      type: "mix" as const,
      title: "A simple fiber",
      targets: { product: ["fiber" as const], minStrengthMPa: 0, mustInclude: ["alginate"] },
    };
    const quest = compileTemplate("pack:test:0", template);
    if (quest.chapter !== "mixing") throw new Error("Expected a mixing quest.");
    const result = simulate(preset.experiment);

    expect(quest.reference).toEqual({ parts: [], conditions: expect.any(Object) });
    expect(quest.grade(preset.experiment, result).stars).toBe(3);
    expect(quest.grade(preset.experiment, { ...result, product: "solution" }).stars).toBe(1);
    expect(quest.grade(preset.experiment, { ...result, product: "solution", events: [] }).feedback[0]).toMatch(/^✗ Product/);
    expect(quest.grade(preset.experiment, { ...result, product: "solution" }).feedback[1]).toMatch(/^✗ Strength/);
  });

  it("grades nucleus targets from numeric half-life seconds", () => {
    const template = {
      type: "nucleus" as const,
      title: "A bound iron nucleus",
      targets: { z: 26, bound: true, minHalfLifeS: 1e12 },
    };
    const quest = compileTemplate("daily:iron", template);
    const report = analyzeNucleus(26, 30);

    expect(report.halfLifeSeconds).toBe(Infinity);
    expect(quest.chapter).toBe("atoms");
    if (quest.chapter !== "atoms") throw new Error("Expected an atom quest.");
    expect(quest.reference).toEqual({ z: 1, n: 0 });
    expect(quest.grade(26, 30).stars).toBe(3);
    expect(quest.grade(26, 30).feedback).toEqual([
      "✓ Z 26 (need 26)",
      "✓ Nucleus is bound (need bound)",
      "✓ Half-life stable (need ≥ 1000000000000 s)",
    ]);
  });

  it("describes human-readable goals", () => {
    expect(describeTargets({
      type: "mix",
      title: "A strong gel",
      targets: { minStrengthMPa: 5, minStretchPct: 20, maxCostPerKg: 2 },
    })).toEqual([
      "Strength at least 5 MPa",
      "Stretch at least 20%",
      "Cost at most $2/kg",
    ]);
  });
});
