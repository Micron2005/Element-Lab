import { describe, expect, it } from "vitest";
import { effectivePH, waterBoilingPointC } from "./conditions";
import { DEFAULT_CONDITIONS } from "./conditions";
import type { Experiment } from "./types";

describe("bench condition helpers", () => {
  it("estimates water boiling points at room pressure and vacuum", () => {
    expect(waterBoilingPointC(101.325)).toBeCloseTo(100, 0);
    expect(waterBoilingPointC(2.34)).toBeGreaterThan(19);
    expect(waterBoilingPointC(2.34)).toBeLessThan(21);
  });

  const mixPH = (parts: Experiment["parts"]) =>
    effectivePH({ parts, conditions: DEFAULT_CONDITIONS });
  const expectBetween = (value: number, min: number, max: number) => {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
  };

  it("returns neutral pH when the mix has no acid/base ingredients", () => {
    expect(mixPH([
      { id: "water", pct: 90 },
      { id: "pva", pct: 10 },
    ])).toBe(7);
  });

  it("solves acidic, basic, and buffered mixtures from ingredient amounts", () => {
    expectBetween(mixPH([
      { id: "water", pct: 90 },
      { id: "acetic-acid", pct: 10 },
    ]), 2.8, 3.4);
    expectBetween(mixPH([
      { id: "borax", pct: 2 },
      { id: "water", pct: 98 },
    ]), 9, 9.4);
    expectBetween(mixPH([
      { id: "sodium-bicarbonate", pct: 5 },
      { id: "water", pct: 95 },
    ]), 8.1, 8.5);
    expect(mixPH([
      { id: "sodium-hydroxide", pct: 1 },
      { id: "water", pct: 99 },
    ])).toBeGreaterThan(13);
    expect(mixPH([
      { id: "sodium-bicarbonate", pct: 1 },
      { id: "citric-acid", pct: 5 },
      { id: "water", pct: 94 },
    ])).toBeLessThan(6);
  });

  it("keeps extreme acidic and basic results within the pH range", () => {
    for (const parts of [
      [{ id: "formic-acid", pct: 100 }],
      [{ id: "sodium-hydroxide", pct: 100 }],
    ]) {
      expectBetween(mixPH(parts), 0, 14);
    }
  });
});
