import { describe, expect, it } from "vitest";
import { analyzeNucleus, elementName } from "./nuclear";

describe("analyzeNucleus", () => {
  it("predicts no decay modes for iron-56", () => {
    expect(analyzeNucleus(26, 30).modes).toEqual([]);
  });

  it("includes alpha decay with a half-life in years for uranium-238", () => {
    const result = analyzeNucleus(92, 146);
    expect(result.modes.some((mode) => mode.startsWith("Alpha decay"))).toBe(true);
    expect(result.halfLife).toContain("years");
  });

  it("marks a neutron-rich helium nucleus as unbound", () => {
    const result = analyzeNucleus(2, 10);
    expect(result.bound).toBe(false);
  });
});

describe("elementName", () => {
  it("returns systematic names for undiscovered elements", () => {
    expect(elementName(120)).toEqual({ name: "Unbinilium", symbol: "Ubn", known: false });
    expect(elementName(119)).toEqual({ name: "Ununennium", symbol: "Uue", known: false });
  });
});
