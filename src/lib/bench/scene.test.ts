import { describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS } from "./conditions";
import { benchPresets } from "./presets";
import { buildMixScene, realTimeAt } from "./scene";
import { simulate } from "./simulate";
import type { Experiment } from "./types";

function sceneFor(experiment: Experiment) {
  return buildMixScene(experiment, simulate(experiment));
}

describe("bench scene data", () => {
  it("builds bond effects and normalized phases for borax slime", () => {
    const preset = benchPresets.find((item) => item.id === "borax-slime")!;
    const scene = sceneFor(preset.experiment);

    expect(scene.effects.some((effect) => effect.eventId === "borax-pva" && effect.kind === "bonds")).toBe(true);
    expect(scene.finalShape).toBe("gel");
    const phaseTotal = scene.phases.reduce(
      (total, phase) => total + phase.end - phase.start,
      0,
    );
    expect(Math.abs(phaseTotal - 1)).toBeLessThanOrEqual(1e-9);
  });

  it("mixes more completely with stirring than with diffusion alone", () => {
    const preset = benchPresets.find((item) => item.id === "borax-slime")!;
    const resting = {
      ...preset.experiment,
      conditions: { ...preset.experiment.conditions, mixRpm: 0, mixMinutes: 10 },
    };
    const stirred = {
      ...preset.experiment,
      conditions: { ...preset.experiment.conditions, mixRpm: 1500, mixMinutes: 10 },
    };

    expect(sceneFor(resting).mixCompleteness).toBeLessThan(sceneFor(stirred).mixCompleteness);
  });

  it("has a higher thermal value for a hotter run", () => {
    const experiment: Experiment = {
      parts: [{ id: "water", pct: 100 }],
      conditions: { ...DEFAULT_CONDITIONS, tempC: 25 },
    };
    const hot = {
      ...experiment,
      conditions: { ...experiment.conditions, tempC: 100 },
    };

    expect(sceneFor(hot).thermal).toBeGreaterThan(sceneFor(experiment).thermal);
  });

  it("shows sodium-water sparks and hazard shape", () => {
    const preset = benchPresets.find((item) => item.id === "sodium-water")!;
    const scene = sceneFor(preset.experiment);

    expect(scene.effects.some((effect) => effect.eventId === "sodium-water" && effect.kind === "spark")).toBe(true);
    expect(scene.finalShape).toBe("hazard");
  });

  it("uses an empty shape when there are no ingredients", () => {
    const experiment: Experiment = { parts: [], conditions: DEFAULT_CONDITIONS };

    expect(sceneFor(experiment).finalShape).toBe("empty");
  });

  it("maps normalized time monotonically to elapsed real seconds", () => {
    const preset = benchPresets.find((item) => item.id === "borax-slime")!;
    const scene = sceneFor(preset.experiment);
    const values = Array.from({ length: 101 }, (_, index) => realTimeAt(scene, index / 100));

    expect(realTimeAt(scene, 0)).toBe(0);
    expect(realTimeAt(scene, 1)).toBe(scene.totalRealSeconds);
    expect(values.every((value, index) => index === 0 || value >= values[index - 1])).toBe(true);
  });
});
