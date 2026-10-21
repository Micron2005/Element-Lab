import { describe, expect, it } from "vitest";
import { analyze, PRESETS } from "./formula";

describe("analyze", () => {
  it("estimates Bio web strength and flags that it is not edible", () => {
    const result = analyze(PRESETS.find((preset) => preset.name.startsWith("Bio web"))!.parts);
    expect(result.tensileMPa).toBeGreaterThan(500);
    expect(result.checks.some((check) => check.level === "bad")).toBe(false);
    expect(result.edible).toBe(false);
  });

  it("describes PVA, borax, and water as swelling and flags borax", () => {
    const result = analyze([
      { id: "pva", pct: 8 },
      { id: "borax", pct: 0.5 },
      { id: "water", pct: 91.5 },
    ]);
    expect(result.water).toBe("swells");
    expect(result.checks.some((check) => check.text.toLowerCase().includes("borax"))).toBe(true);
  });

  it("flags nylon polymer mixed with water as a bad solvent match", () => {
    const result = analyze([{ id: "nylon66", pct: 20 }, { id: "water", pct: 80 }]);
    expect(result.checks.some((check) => check.level === "bad" && /won.t dissolve/i.test(check.text))).toBe(true);
  });

  it("flags an empty formula as missing structural polymer", () => {
    const result = analyze([]);
    expect(result.checks.some((check) => check.text.includes("No structural polymer"))).toBe(true);
  });
});
