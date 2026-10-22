import { describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS } from "./conditions";
import { benchPresets } from "./presets";
import { simulate } from "./simulate";
import {
  DEFAULT_SHOT,
  fluidFromMix,
  formatBar,
  shootTest,
} from "./shootTest";
import type { Experiment } from "./types";

function experiment(parts: Experiment["parts"], forming: Experiment["conditions"]["forming"] = "beaker"): Experiment {
  return { parts, conditions: { ...DEFAULT_CONDITIONS, forming } };
}

function preset(id: string): Experiment {
  const found = benchPresets.find((item) => item.id === id);
  if (!found) throw new Error(`Missing preset: ${id}`);
  return found.experiment;
}

describe("fluidFromMix", () => {
  it("uses water properties for a pure-water mix", () => {
    const exp = experiment([{ id: "water", pct: 100 }]);
    const fluid = fluidFromMix(exp, simulate(exp));
    expect(fluid.densityKgM3).toBeCloseTo(1000, 0);
    expect(fluid.viscosityPas).toBeCloseTo(0.00089, 5);
    expect(fluid.surfaceTensionNm).toBe(0.072);
    expect(fluidFromMix(exp, simulate(exp)).densityKgM3).toBeGreaterThanOrEqual(995);
    expect(shootTest(exp, simulate(exp), DEFAULT_SHOT).verdict).toBe("breaks-up");
  });

  it("thickens PVA from the polymer share and reacts to target distance", () => {
    const exp = experiment([
      { id: "pva", pct: 12 },
      { id: "water", pct: 88 },
    ]);
    const result = simulate(exp);
    const fluid = fluidFromMix(exp, result);
    expect(fluid.viscosityPas).toBeGreaterThanOrEqual(0.1);
    expect(fluid.viscosityPas).toBeLessThanOrEqual(5);
    expect(shootTest(exp, result, { ...DEFAULT_SHOT, distanceM: 3 }).verdict).toBe("shoots");
    expect(shootTest(exp, result, DEFAULT_SHOT).verdict).toBe("breaks-up");
  });

  it("geometrically blends glycerol and water viscosity", () => {
    const water = experiment([{ id: "water", pct: 100 }]);
    const mix = experiment([
      { id: "glycerol", pct: 50 },
      { id: "water", pct: 50 },
    ]);
    const glycerol = experiment([{ id: "glycerol", pct: 100 }]);
    const viscosity = (exp: Experiment) =>
      fluidFromMix(exp, simulate(exp)).viscosityPas ?? 0;
    expect(viscosity(mix)).toBeGreaterThan(viscosity(water));
    expect(viscosity(mix)).toBeLessThan(viscosity(glycerol));
  });

  it("makes borax slime thicker than PVA solution", () => {
    const slime = preset("borax-slime");
    const pva = experiment([
      { id: "pva", pct: 12 },
      { id: "water", pct: 88 },
    ]);
    expect(fluidFromMix(slime, simulate(slime)).viscosityPas).toBeGreaterThan(
      fluidFromMix(pva, simulate(pva)).viscosityPas ?? 0,
    );
  });

  it("returns a safe, finite estimate for a never-setting liquid", () => {
    const exp = experiment([{ id: "water", pct: 100 }]);
    const result = simulate(exp);
    expect(result.setSeconds).toBe(0);
    const shot = shootTest(exp, result, DEFAULT_SHOT);
    expect(shot.jet).not.toBeNull();
    for (const value of Object.values(shot.jet ?? {})) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("shootTest", () => {
  it("does not fire a dangerous sodium-water preset", () => {
    const exp = preset("sodium-water");
    const shot = shootTest(exp, simulate(exp), DEFAULT_SHOT);
    expect(shot.verdict).toBe("unsafe");
    expect(shot.jet).toBeNull();
  });

  it("rejects dry gelatin and excessive graphene filler", () => {
    const gelatin = experiment([{ id: "gelatin", pct: 100 }]);
    const graphene = experiment([
      { id: "graphene", pct: 70 },
      { id: "water", pct: 30 },
    ]);
    expect(shootTest(gelatin, simulate(gelatin), DEFAULT_SHOT).verdict).toBe("too-thick");
    expect(shootTest(graphene, simulate(graphene), DEFAULT_SHOT).verdict).toBe("too-thick");
  });

  it("shoots the spider-web preset when the strand clears the launch height", () => {
    const exp = preset("spider-web");
    const shot = shootTest(exp, simulate(exp), {
      ...DEFAULT_SHOT,
      nozzleMm: 10,
      nozzleLengthMm: 0.5,
      speedMs: 5,
      distanceM: 0.5,
    });
    expect(shot.verdict).toBe("shoots");
    expect(shot.jet?.dropM).toBeLessThan(1.5);
    expect(shot.jet?.minSpeed).toBeLessThanOrEqual(5);
    expect(Number.isFinite(shot.holdsKg)).toBe(true);
    expect(shot.holdsKg).toBeGreaterThan(0);
  });

  it("reports a spider-web strand that hits the ground before the target", () => {
    const exp = preset("spider-web");
    const shot = shootTest(exp, simulate(exp), {
      ...DEFAULT_SHOT,
      nozzleMm: 10,
      nozzleLengthMm: 0.5,
      speedMs: 0.5,
      distanceM: 0.5,
    });
    expect(shot.verdict).toBe("falls-short");
    expect(shot.headline).toContain("ground about 0.3 m out");
  });

  it("suggests a safe speed for high-pressure borax slime", () => {
    const exp = preset("borax-slime");
    const shot = shootTest(exp, simulate(exp), DEFAULT_SHOT);
    expect(shot.verdict).toBe("too-thick");
    expect(shot.headline).toContain("1,000 bar");
    expect(shot.notes.some((note) => note.includes("fire up to") || note.includes("No useful speed"))).toBe(true);
    expect(shot.notes.some((note) => note.includes("Minimum speed"))).toBe(false);
  });

  it("formats pressure in bar or millions of bar", () => {
    expect(formatBar(12800002)).toBe("12.8 million");
    expect(formatBar(116)).toBe("116");
  });

  it("reports a fast-setting beaker mix as a cartridge clog", () => {
    const exp = experiment(
      [
        { id: "cyanoacrylate", pct: 10 },
        { id: "water", pct: 90 },
      ],
      "beaker",
    );
    const result = simulate(exp);
    expect(result.product).toBe("clumps");
    expect(result.setSeconds).toBe(2);
    const shot = shootTest(exp, result, DEFAULT_SHOT);
    expect(shot.verdict).toBe("sets-in-cartridge");
    expect(shot.headline).toContain(`${result.setSeconds.toFixed(1)} s`);
  });

  it("allows a nothing-labeled pure liquid to be shot", () => {
    const exp = experiment([{ id: "water", pct: 100 }]);
    const result = simulate(exp);
    const shot = shootTest(exp, result, DEFAULT_SHOT);
    expect(shot.verdict).toBe("breaks-up");
    expect(shot.jet).not.toBeNull();
  });
});
