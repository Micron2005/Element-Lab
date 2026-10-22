import { describe, expect, it } from "vitest";
import { ATOMS, type AtomSymbol } from "./atoms";

describe("play atom definitions", () => {
  it("defines each supported atom with its expected valence and Pauling electronegativity", () => {
    const expected: Record<AtomSymbol, [number, number]> = {
      H: [1, 2.2],
      C: [4, 2.55],
      N: [3, 3.04],
      O: [2, 3.44],
      F: [1, 3.98],
      Cl: [1, 3.16],
      S: [2, 2.58],
      P: [3, 2.19],
    };
    for (const [symbol, [valence, electronegativity]] of Object.entries(expected) as [
      AtomSymbol,
      [number, number],
    ][]) {
      expect(ATOMS[symbol].valence).toBe(valence);
      expect(ATOMS[symbol].electronegativity).toBe(electronegativity);
      expect(ATOMS[symbol].radius).toBeGreaterThanOrEqual(16);
      expect(ATOMS[symbol].radius).toBeLessThanOrEqual(24);
    }
    expect(ATOMS.H.radius).toBeLessThan(Math.min(...Object.values(ATOMS).filter((atom) => atom.symbol !== "H").map((atom) => atom.radius)));
  });
});
