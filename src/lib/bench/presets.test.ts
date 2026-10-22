import { describe, expect, it } from "vitest";
import { effectivePH } from "./conditions";
import { benchPresets } from "./presets";
import { simulate } from "./simulate";

describe("expanded bench presets", () => {
  it("runs each new preset's key event and returns a sensible product", () => {
    const expected: {
      presetId: string;
      eventId: string;
      product: ReturnType<typeof simulate>["product"];
    }[] = [
      {
        presetId: "baking-soda-vinegar",
        eventId: "bicarbonate-bubbles",
        product: "solution",
      },
      {
        presetId: "sodium-water",
        eventId: "sodium-water",
        product: "dangerous",
      },
      {
        presetId: "chitosan-film",
        eventId: "chitosan-solubility",
        product: "film",
      },
      {
        presetId: "enzyme-breaks-gel",
        eventId: "protease-digestion",
        product: "gel",
      },
    ];

    for (const item of expected) {
      const preset = benchPresets.find((candidate) => candidate.id === item.presetId);
      expect(preset, `missing preset ${item.presetId}`).toBeDefined();
      const result = simulate(preset!.experiment);
      const event = result.events.find((candidate) => candidate.id === item.eventId);

      expect(["happened", "partial"]).toContain(event?.status);
      expect(result.product).toBe(item.product);
    }
  });

  it("keeps pH-sensitive presets inside their ingredient-driven ranges", () => {
    const phFor = (presetId: string) => {
      const preset = benchPresets.find((candidate) => candidate.id === presetId);
      expect(preset, `missing preset ${presetId}`).toBeDefined();
      return effectivePH(preset!.experiment);
    };

    expect(phFor("chitosan-film")).toBeLessThan(6.5);
    expect(phFor("mussel-glue")).toBeGreaterThanOrEqual(7.5);
    expect(phFor("mussel-glue")).toBeLessThanOrEqual(9);
    expect(phFor("enzyme-breaks-gel")).toBeGreaterThanOrEqual(7);
    expect(phFor("enzyme-breaks-gel")).toBeLessThanOrEqual(9);
    expect(phFor("borax-slime")).toBeGreaterThanOrEqual(8);
  });

  it("keeps the neutral-pH gelatin crosslinking preset active", () => {
    const preset = benchPresets.find((candidate) => candidate.id === "enzyme-gelatin");
    expect(preset).toBeDefined();
    const event = simulate(preset!.experiment).events.find(
      (candidate) => candidate.id === "transglutaminase",
    );
    expect(["happened", "partial"]).toContain(event?.status);
  });
});
