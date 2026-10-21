import { describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS } from "./conditions";
import { benchPresets } from "./presets";
import { REACTIONS } from "./reactions";
import { simulate } from "./simulate";
import type { Experiment, Part } from "./types";

function experiment(
  parts: Part[],
  overrides: Partial<Experiment["conditions"]> = {},
): Experiment {
  return {
    parts,
    conditions: { ...DEFAULT_CONDITIONS, ...overrides },
  };
}

describe("bench simulation", () => {
  it("keeps the specified reaction table to twenty rules", () => {
    expect(REACTIONS).toHaveLength(20);
  });

  it("forms alginate fiber in a calcium bath and warns about calcium-first beaker mixing", () => {
    const fiber = simulate(
      experiment(
        [
          { id: "alginate", pct: 10 },
          { id: "water", pct: 90 },
        ],
        { forming: "extrude-bath", bathId: "cacl2" },
      ),
    );
    expect(fiber.product).toBe("fiber");
    expect(fiber.events.find((event) => event.id === "alginate-calcium")?.status).toBe("happened");

    const beaker = simulate(
      experiment([
        { id: "cacl2", pct: 5 },
        { id: "alginate", pct: 5 },
        { id: "water", pct: 90 },
      ]),
    );
    expect(beaker.warnings.some((warning) => warning.text.includes("Gels on contact into lumps"))).toBe(true);
  });

  it("activates transglutaminase at its optimum and blocks it when denatured", () => {
    const good = simulate(
      experiment(
        [
          { id: "gelatin", pct: 40 },
          { id: "water", pct: 58 },
          { id: "transglutaminase", pct: 2 },
        ],
        { tempC: 50, pH: 6 },
      ),
    );
    const event = good.events.find((item) => item.id === "transglutaminase");
    expect(event?.status).toBe("happened");
    expect(event?.activity).toBeGreaterThan(0.8);

    const denatured = simulate(
      experiment(
        [
          { id: "gelatin", pct: 40 },
          { id: "water", pct: 58 },
          { id: "transglutaminase", pct: 2 },
        ],
        { tempC: 80, pH: 6 },
      ),
    );
    const blocked = denatured.events.find((item) => item.id === "transglutaminase");
    expect(blocked?.status).toBe("blocked");
    expect(blocked?.reasons.join(" ")).toContain("denatured");
  });

  it("blocks oxygen-dependent tyrosinase in nitrogen", () => {
    const result = simulate(
      experiment(
        [
          { id: "silk-fibroin", pct: 40 },
          { id: "water", pct: 58 },
          { id: "tyrosinase", pct: 2 },
        ],
        { tempC: 30, pH: 6.5, atmosphere: "nitrogen" },
      ),
    );
    const event = result.events.find((item) => item.id === "phenol-oxidase");
    expect(event?.status).toBe("blocked");
    expect(event?.reasons.join(" ")).toContain("needs oxygen");
  });

  it("clumps cyanoacrylate when water starts curing inside the mix", () => {
    const result = simulate(
      experiment([
        { id: "cyanoacrylate", pct: 20 },
        { id: "water", pct: 80 },
      ]),
    );
    expect(result.product).toBe("clumps");
    expect(result.events.find((event) => event.id === "cyanoacrylate")?.status).toBe("happened");
  });

  it("requires heat for latex vulcanization and strengthens the cured mix", () => {
    const parts = [
      { id: "latex", pct: 70 },
      { id: "sulfur", pct: 30 },
    ];
    const cold = simulate(experiment(parts, { tempC: 25, cureMinutes: 30 }));
    const hot = simulate(experiment(parts, { tempC: 150, cureMinutes: 30, forming: "heat-cure" }));
    expect(cold.events.find((event) => event.id === "latex-cure")?.status).toBe("blocked");
    expect(hot.events.find((event) => event.id === "latex-cure")?.status).toBe("happened");
    expect(hot.tensileMPa).toBeGreaterThan(cold.tensileMPa);
  });

  it("reduces protein strength when active trypsin digests gelatin", () => {
    const withoutEnzyme = simulate(
      experiment([
        { id: "gelatin", pct: 45 },
        { id: "water", pct: 55 },
      ], { tempC: 37, pH: 8 }),
    );
    const withEnzyme = simulate(
      experiment(
        [
          { id: "gelatin", pct: 45 },
          { id: "water", pct: 50 },
          { id: "trypsin", pct: 5 },
        ],
        { tempC: 37, pH: 8 },
      ),
    );
    expect(withEnzyme.events.find((event) => event.id === "protease-digestion")?.status).toBe("happened");
    expect(withEnzyme.tensileMPa).toBeLessThan(withoutEnzyme.tensileMPa);
  });

  it("flags sodium metal and water as dangerous", () => {
    const result = simulate(
      experiment([
        { id: "sodium-metal", pct: 5 },
        { id: "water", pct: 95 },
      ]),
    );
    expect(result.product).toBe("dangerous");
    expect(result.wetToxicity).toBe(3);
    expect(result.effectivePH).toBe(14);
  });

  it("reports copper sulfate and keratin as unmodelled", () => {
    const result = simulate(
      experiment([
        { id: "cuso4", pct: 10 },
        { id: "keratin", pct: 90 },
      ]),
    );
    expect(result.notModelled.join(" ")).toContain("Copper(II) sulfate + Keratin: not in the model");
    expect(result.confidence).toBeLessThan(1);
  });

  it("warns when water boils under vacuum", () => {
    const result = simulate(
      experiment(
        [{ id: "water", pct: 100 }],
        { tempC: 25, pressureKPa: 2, atmosphere: "vacuum" },
      ),
    );
    expect(result.warnings.some((warning) => warning.text.includes("boils off violently"))).toBe(true);
  });

  it("caps spider-silk strength and gives the preset a nonzero set time", () => {
    const spiderPreset = benchPresets.find((preset) => preset.id === "spider-web")!;
    const result = simulate(spiderPreset.experiment);

    expect(result.tensileMPa).toBeLessThanOrEqual(1375);
    expect(result.setSeconds).toBeGreaterThan(0);
  });

  it("dilutes silk with room-temperature sulfur and clumps dry silk powder", () => {
    const sulfurMix = simulate(
      experiment(
        [
          { id: "spider-silk", pct: 10 },
          { id: "sulfur", pct: 60 },
          { id: "water", pct: 30 },
        ],
        { tempC: 25, forming: "cast-film" },
      ),
    );
    const silkAndWater = simulate(
      experiment(
        [
          { id: "spider-silk", pct: 40 },
          { id: "water", pct: 60 },
        ],
        { forming: "cast-film" },
      ),
    );
    const dryPowder = simulate(
      experiment([{ id: "spider-silk", pct: 100 }]),
    );

    expect(sulfurMix.tensileMPa).toBeLessThan(silkAndWater.tensileMPa);
    expect(dryPowder.product).toBe("clumps");
    expect(dryPowder.warnings.map((warning) => warning.text)).toContain(
      "Dry powder: nothing here dissolves it, so it can't be spun or cast.",
    );
  });

  it("marks a pH 0.5 mixture corrosive and caps borax slime strength", () => {
    const acidic = simulate(
      experiment(
        [
          { id: "spider-silk", pct: 40 },
          { id: "water", pct: 60 },
        ],
        { pH: 0.5, forming: "cast-film" },
      ),
    );
    const slimePreset = benchPresets.find((preset) => preset.id === "borax-slime")!;
    const slime = simulate(slimePreset.experiment);

    expect(acidic.skin).toBe(3);
    expect(acidic.wetToxicity).toBeGreaterThanOrEqual(2);
    expect(acidic.edible).toBe(false);
    expect(acidic.warnings.some((warning) => warning.text.includes("pH 0.5"))).toBe(true);
    expect(slime.tensileMPa).toBeLessThanOrEqual(1);
  });

  it("explains partial borax-PVA activity at pH 7.5", () => {
    const result = simulate(
      experiment(
        [
          { id: "pva", pct: 40 },
          { id: "water", pct: 58 },
          { id: "borax", pct: 2 },
        ],
        { pH: 7.5 },
      ),
    );
    const event = result.events.find((item) => item.id === "borax-pva");

    expect(event?.status).toBe("partial");
    expect(event?.activity).toBe(0.5);
    expect(event?.reasons.join(" ")).toContain("pH 7.5");
  });

  it("gives gelatin thermo-gel a set time based on temperature", () => {
    const parts = [
      { id: "gelatin", pct: 40 },
      { id: "water", pct: 60 },
    ];
    const roomTemperatureGel = simulate(experiment(parts, { tempC: 20 }));
    const coldGel = simulate(experiment(parts, { tempC: 10 }));

    expect(roomTemperatureGel.product).toBe("gel");
    expect(roomTemperatureGel.setSeconds).toBe(1800);
    expect(coldGel.setSeconds).toBe(600);
  });

  it("uses volatile-solvent drying times for cast films", () => {
    const waterFilm = simulate(
      experiment(
        [
          { id: "pva", pct: 40 },
          { id: "water", pct: 60 },
        ],
        { forming: "cast-film" },
      ),
    );
    const alcoholFilm = simulate(
      experiment(
        [
          { id: "zein", pct: 40 },
          { id: "ethanol", pct: 60 },
        ],
        { forming: "cast-film" },
      ),
    );

    expect(waterFilm.setSeconds).toBe(2 * 60 * 60);
    expect(alcoholFilm.setSeconds).toBe(20 * 60);
  });
});
