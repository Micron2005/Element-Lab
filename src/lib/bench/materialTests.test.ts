import { describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS } from "./conditions";
import { benchPresets } from "./presets";
import { simulate } from "./simulate";
import {
  DEFAULT_DROP,
  DEFAULT_DISSOLVE,
  DEFAULT_HEAT,
  DEFAULT_STICK,
  DEFAULT_STRETCH,
  dissolveTest,
  dropTest,
  heatTest,
  stickTest,
  stretchTest,
} from "./materialTests";
import type { Experiment, Part } from "./types";

function experiment(parts: Part[], overrides: Partial<Experiment["conditions"]> = {}): Experiment {
  return {
    parts,
    conditions: { ...DEFAULT_CONDITIONS, ...overrides },
  };
}

function run(exp: Experiment) {
  return { experiment: exp, result: simulate(exp) };
}

function preset(id: string): Experiment {
  const found = benchPresets.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing preset ${id}`);
  return found.experiment;
}

function metricNumber(report: { metrics: { label: string; value: string }[] }, label: string) {
  const value = report.metrics.find((metric) => metric.label === label)?.value ?? "";
  return Number.parseFloat(value.replaceAll(",", ""));
}

describe("material bench tests", () => {
  it("estimates rubber stretch break force and rebound note", () => {
    const sample = run(preset("vulcanized-latex"));
    const report = stretchTest(sample.experiment, sample.result, DEFAULT_STRETCH);
    const expectedHolds =
      (sample.result.tensileMPa * 1e6 * Math.PI * (1 / 2000) ** 2) / 9.81;

    expect(report.verdict).toBe("breaks");
    expect(report.tone).toBe("good");
    expect(report.notes).toContain(
      "Snaps back close to its length when released (rubbery).",
    );
    expect(report.holdsKg).toBeCloseTo(expectedHolds, 10);
    expect(metricNumber(report, "Holds")).toBeCloseTo(expectedHolds, 2);
  });

  it("changes slime response with pull speed", () => {
    const sample = run(preset("borax-slime"));
    const fast = stretchTest(sample.experiment, sample.result, {
      ...DEFAULT_STRETCH,
      pullMmPerMin: 10_000,
    });
    const slow = stretchTest(sample.experiment, sample.result, {
      ...DEFAULT_STRETCH,
      pullMmPerMin: 1,
    });
    expect(fast.verdict).toBe("snaps");
    expect(fast.tone).toBe("warn");
    expect(slow.verdict).toBe("flows");
    expect(slow.tone).toBe("warn");
  });

  it("does not stretch a water-only mix", () => {
    const sample = run(experiment([{ id: "water", pct: 100 }]));
    expect(stretchTest(sample.experiment, sample.result, DEFAULT_STRETCH)).toMatchObject({
      verdict: "nothing-to-test",
      headline: "There's no solid to pull; it's a liquid mix.",
    });
  });

  it("reports gelatin melting, reversible setting, and water loss", () => {
    const sample = run(experiment([{ id: "gelatin", pct: 45 }, { id: "water", pct: 55 }]));
    expect(sample.result.product).toBe("gel");
    const warm = heatTest(sample.experiment, sample.result, {
      ...DEFAULT_HEAT,
      maxTempC: 40,
    });
    expect(warm.events.some((event) => event.text === "The gelatin network melts (it re-sets when cooled).")).toBe(true);
    expect(warm.reversible).toBe(true);
    expect(warm.notes).toContain("Cools back to roughly how it was.");

    const hot = heatTest(sample.experiment, sample.result, {
      ...DEFAULT_HEAT,
      maxTempC: 150,
    });
    expect(hot.events.some((event) => event.tempC === 100 && event.kind === "evaporate")).toBe(true);
    expect(hot.massLostPct).toBeGreaterThanOrEqual(55);
  });

  it("blocks heating and dissolving a dangerous sodium mix", () => {
    const sample = run(preset("sodium-water"));
    expect(sample.result.product).toBe("dangerous");
    expect(heatTest(sample.experiment, sample.result, DEFAULT_HEAT).verdict).toBe("unsafe");
    expect(dissolveTest(sample.experiment, sample.result, DEFAULT_DISSOLVE).verdict).toBe("unsafe");
  });

  it("adds an air burn warning for a protein film but not in nitrogen", () => {
    const exp = experiment(
      [
        { id: "spider-silk", pct: 55 },
        { id: "water", pct: 45 },
      ],
      { forming: "cast-film" },
    );
    const sample = run(exp);
    expect(sample.result.product).toBe("film");
    const air = heatTest(sample.experiment, sample.result, {
      ...DEFAULT_HEAT,
      maxTempC: 600,
    });
    const nitrogen = heatTest(sample.experiment, sample.result, {
      ...DEFAULT_HEAT,
      maxTempC: 600,
      atmosphere: "nitrogen",
    });
    expect(air.events.some((event) => event.kind === "burn")).toBe(true);
    expect(nitrogen.events.some((event) => event.kind === "burn")).toBe(false);
    const airDecomposition = air.events.find((event) => event.kind === "decompose");
    const nitrogenDecomposition = nitrogen.events.find(
      (event) => event.kind === "decompose",
    );
    expect(nitrogenDecomposition?.text).toBe(
      `${airDecomposition?.text?.replace(/\.$/, "")} without burning (no oxygen).`,
    );
  });

  it("models gelatin swelling cold and dissolving warm", () => {
    const sample = run(experiment([{ id: "gelatin", pct: 45 }, { id: "water", pct: 55 }]));
    expect(
      dissolveTest(sample.experiment, sample.result, {
        ...DEFAULT_DISSOLVE,
        tempC: 10,
      }).verdict,
    ).toBe("swells");
    expect(
      dissolveTest(sample.experiment, sample.result, {
        ...DEFAULT_DISSOLVE,
        tempC: 50,
      }).verdict,
    ).toBe("dissolves");
  });

  it("models calcium alginate swelling in water and slow salt-water breakdown", () => {
    const sample = run(preset("alginate-fiber"));
    const water = dissolveTest(sample.experiment, sample.result, DEFAULT_DISSOLVE);
    const saltWater = dissolveTest(sample.experiment, sample.result, {
      ...DEFAULT_DISSOLVE,
      liquid: "salt-water",
    });
    expect(water.verdict).toBe("swells");
    expect(saltWater.verdict).toBe("dissolves");
    expect(saltWater.timeSeconds).toBeGreaterThan(3600);
  });

  it("scales swelling time with thickness and stirring", () => {
    const sample = run(preset("alginate-fiber"));
    const thin = dissolveTest(sample.experiment, sample.result, {
      ...DEFAULT_DISSOLVE,
      thicknessMm: 0.1,
    });
    const thick = dissolveTest(sample.experiment, sample.result, {
      ...DEFAULT_DISSOLVE,
      thicknessMm: 0.2,
    });
    const stirred = dissolveTest(sample.experiment, sample.result, {
      ...DEFAULT_DISSOLVE,
      thicknessMm: 0.2,
      stirred: true,
    });
    expect(thick.timeSeconds).toBeCloseTo((thin.timeSeconds ?? 0) * 4);
    expect(stirred.timeSeconds).toBeCloseTo((thick.timeSeconds ?? 0) / 2);
  });

  it("compares cyanoacrylate adhesion across surfaces and press time", () => {
    const sample = run(
      experiment([{ id: "cyanoacrylate", pct: 100 }], { forming: "extrude-air" }),
    );
    expect(sample.result.product).toBe("adhesive");
    const glass = stickTest(sample.experiment, sample.result, {
      ...DEFAULT_STICK,
      pressMinutes: 0,
    });
    const ptfe = stickTest(sample.experiment, sample.result, {
      ...DEFAULT_STICK,
      surface: "ptfe",
      pressMinutes: 0,
    });
    const pressed = stickTest(sample.experiment, sample.result, {
      ...DEFAULT_STICK,
      pressMinutes: 60,
    });
    expect(glass.holdsKg).toBeGreaterThanOrEqual(ptfe.holdsKg * 10);
    expect(pressed.holdsKg).toBeGreaterThan(glass.holdsKg);
  });

  it("refuses to model an unsafe material on skin", () => {
    const sample = run(
      experiment([
        { id: "sodium-hydroxide", pct: 2 },
        { id: "water", pct: 98 },
      ]),
    );
    expect(sample.result.skin).toBeGreaterThanOrEqual(2);
    expect(
      stickTest(sample.experiment, sample.result, {
        ...DEFAULT_STICK,
        surface: "skin",
      }),
    ).toMatchObject({
      verdict: "unsafe",
      headline: "Not skin-safe; the model won't test it on skin.",
    });
  });

  it("models rubber bounce, weak gel fracture, and liquid splashing", () => {
    const rubber = run(preset("vulcanized-latex"));
    const hardBounce = dropTest(rubber.experiment, rubber.result, {
      ...DEFAULT_DROP,
      heightM: 1,
      floor: "hard",
    });
    const softBounce = dropTest(rubber.experiment, rubber.result, {
      ...DEFAULT_DROP,
      heightM: 1,
      floor: "soft",
    });
    expect(hardBounce.bounceM).toBeCloseTo(0.49);
    expect(softBounce.bounceM).toBeLessThan(hardBounce.bounceM ?? 0);

    const gel = run(experiment([{ id: "gelatin", pct: 45 }, { id: "water", pct: 55 }]));
    expect(
      dropTest(gel.experiment, gel.result, {
        ...DEFAULT_DROP,
        heightM: 50,
      }).verdict,
    ).toBe("breaks");

    const liquid = run(experiment([{ id: "water", pct: 100 }]));
    expect(dropTest(liquid.experiment, liquid.result, DEFAULT_DROP).verdict).toBe("splashes");
  });

  it("returns unsafe for every new test when the current mix is dangerous", () => {
    const sample = run(preset("sodium-water"));
    expect(stretchTest(sample.experiment, sample.result, DEFAULT_STRETCH).verdict).toBe("unsafe");
    expect(heatTest(sample.experiment, sample.result, DEFAULT_HEAT).verdict).toBe("unsafe");
    expect(dissolveTest(sample.experiment, sample.result, DEFAULT_DISSOLVE).verdict).toBe("unsafe");
    expect(stickTest(sample.experiment, sample.result, DEFAULT_STICK).verdict).toBe("unsafe");
    expect(dropTest(sample.experiment, sample.result, DEFAULT_DROP).verdict).toBe("unsafe");
  });

});
