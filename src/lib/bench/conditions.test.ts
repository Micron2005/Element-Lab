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

  it("applies ingredient pH shifts and clamps the effective value", () => {
    const experiment: Experiment = {
      parts: [{ id: "acetic-acid", pct: 5 }],
      conditions: { ...DEFAULT_CONDITIONS, pH: 7 },
    };
    expect(effectivePH(experiment)).toBeLessThan(7);
    expect(
      effectivePH({
        ...experiment,
        conditions: { ...experiment.conditions, pH: 1 },
        parts: [{ id: "formic-acid", pct: 100 }],
      }),
    ).toBe(0);
  });
});
