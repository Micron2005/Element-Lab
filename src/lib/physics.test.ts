import { describe, expect, it } from "vitest";
import { jet, strandForLoad } from "./physics";

describe("strandForLoad", () => {
  it("estimates a required strand diameter for a person-sized load", () => {
    const result = strandForLoad({ massKg: 70, tensileMPa: 1100, strands: 1, dynamicFactor: 2, safetyFactor: 3 });
    expect(result.diameterMm).toBeCloseTo(2.18, 2);
  });
});

describe("jet", () => {
  it("estimates flight time and gravity drop", () => {
    const result = jet({
      nozzleMm: 0.5,
      speedMs: 20,
      distanceM: 10,
      viscosityPas: 1,
      densityKgM3: 1100,
      surfaceTensionNm: 0.05,
      nozzleLengthMm: 5,
      solidsFraction: 0.2,
      cartridgeMl: 30,
      cureSeconds: 2,
    });
    expect(result.flightS).toBe(0.5);
    expect(result.dropM).toBeCloseTo(1.226, 3);
  });
});
