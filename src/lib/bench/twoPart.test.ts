import { describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS } from "./conditions";
import { DEFAULT_SHOT } from "./shootTest";
import {
  CARTRIDGE_B_STORAGE,
  DEFAULT_RATIO,
  checkCartridge,
  clogsAtTip,
  combineAtTip,
  parseStoredCartridgeB,
  tipOutcome,
  twoPartShoot,
} from "./twoPart";
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

const alginateA = experiment(
  [
    { id: "alginate", pct: 8 },
    { id: "water", pct: 92 },
  ],
  { mixRpm: 300, forming: "beaker", bathId: "cacl2" },
);
const calciumB: Part[] = [
  { id: "cacl2", pct: 5 },
  { id: "water", pct: 95 },
];

describe("two-part nozzle", () => {
  it("labels active alginate-calcium setting and preserves other product labels", () => {
    const combined = combineAtTip(alginateA, calciumB, DEFAULT_RATIO);
    const settingResult = simulate(combined);
    const noReactionResult = simulate(
      experiment([{ id: "water", pct: 100 }]),
    );

    expect(settingResult.setSeconds).toBeGreaterThan(0);
    expect(tipOutcome(settingResult)).toBe("Gels after it leaves the nozzle");
    expect(tipOutcome(noReactionResult)).toBe(noReactionResult.productLabel);
  });

  it("normalizes and combines cartridge contents at the tip", () => {
    const combined = combineAtTip(
      alginateA,
      calciumB,
      { ratioA: 1, ratioB: 3 },
    );
    const percent = (id: string) =>
      combined.parts.find((part) => part.id === id)?.pct;

    expect(percent("alginate")).toBe(2);
    expect(percent("cacl2")).toBe(3.75);
    expect(percent("water")).toBe(94.25);
    expect(combined.parts.map((part) => part.id)).toEqual([
      "alginate",
      "water",
      "cacl2",
    ]);
    expect(combined.parts.reduce((sum, part) => sum + part.pct, 0)).toBe(100);
    expect(combined.conditions).toEqual({
      ...alginateA.conditions,
      forming: "extrude-air",
    });
  });

  it("keeps alginate and calcium separate until they meet at the tip", () => {
    const report = twoPartShoot(alginateA, calciumB, DEFAULT_RATIO, DEFAULT_SHOT);
    expect(report.a.issue).toBeNull();
    expect(report.b.issue).toBeNull();
    expect(report.combined).not.toBeNull();
    const event = report.combined?.result.events.find(
      (item) => item.id === "alginate-calcium",
    );
    expect(event?.status).toBe("happened");
    expect(event?.activity).toBeGreaterThan(0);
    expect(report.combined?.result.setSeconds).toBeGreaterThan(0);
    expect(report.combined?.result.setSeconds).toBeLessThanOrEqual(10);
    expect(report.clogsNozzle).toBe(false);
    expect(report.shot).not.toBeNull();
  });

  it("sets during a long flight but not during the default flight", () => {
    const longFlight = twoPartShoot(alginateA, calciumB, DEFAULT_RATIO, {
      ...DEFAULT_SHOT,
      distanceM: 100,
      speedMs: 5,
    });
    const defaultFlight = twoPartShoot(
      alginateA,
      calciumB,
      DEFAULT_RATIO,
      DEFAULT_SHOT,
    );
    expect(longFlight.shot?.jet?.curesInFlight).toBe(true);
    expect(defaultFlight.shot?.jet?.curesInFlight).toBe(false);
  });

  it("flags fast alginate-calcium setting in cartridge B", () => {
    const report = twoPartShoot(
      alginateA,
      [
        { id: "alginate", pct: 4 },
        { id: "cacl2", pct: 2 },
        { id: "water", pct: 94 },
      ],
      DEFAULT_RATIO,
      DEFAULT_SHOT,
    );
    expect(report.b.issue).toBe("sets-in-cartridge");
    expect(report.b.result?.product).toBe("solution");
    expect(report.b.result?.setSeconds).toBe(5);
    expect(report.combined).toBeNull();
    expect(report.headline).toContain("Cartridge B");
  });

  it("rejects a cartridge without liquid", () => {
    const check = checkCartridge(
      "B",
      [{ id: "cacl2", pct: 100 }],
      DEFAULT_CONDITIONS,
    );
    expect(check.issue).toBe("no-liquid");
  });

  it("reports an empty cartridge", () => {
    const check = checkCartridge("B", [], DEFAULT_CONDITIONS);
    expect(check.issue).toBe("empty");
    expect(check.message).toBe("Add ingredients to cartridge B.");
  });

  it("uses nozzle residence time to detect tip clogs", () => {
    const slowShot = { ...DEFAULT_SHOT, nozzleLengthMm: 100, speedMs: 0.5 };
    expect(clogsAtTip(0.1, slowShot)).toBe(true);
    expect(clogsAtTip(0.21, slowShot)).toBe(false);
    expect(clogsAtTip(0, slowShot)).toBe(false);
  });

  it("filters invalid, unknown, and duplicate stored cartridge parts", () => {
    expect(
      parseStoredCartridgeB([
        { id: "water", pct: 20 },
        { id: "water", pct: 30 },
        { id: "missing", pct: 10 },
        { id: "cacl2", pct: Number.NaN },
        { id: "cacl2", pct: Number.POSITIVE_INFINITY },
        { id: "cacl2", pct: -1 },
        { id: "cacl2", pct: 101 },
        { id: "cacl2", pct: 0 },
      ]),
    ).toEqual([
      { id: "water", pct: 20 },
      { id: "cacl2", pct: 0 },
    ]);
    expect(parseStoredCartridgeB(null)).toEqual([]);
    expect(CARTRIDGE_B_STORAGE).toBe("elementlab.bench.cartridgeB");
  });

  it("limits refills by the smaller B cartridge share", () => {
    const report = twoPartShoot(
      alginateA,
      calciumB,
      { ratioA: 1, ratioB: 3 },
      DEFAULT_SHOT,
    );
    const volumeMl = report.shot?.jet?.volumeMl ?? 0;
    expect(report.shotsPerCartridge).toBeCloseTo(
      DEFAULT_SHOT.cartridgeMl / (volumeMl * 0.75),
    );
    expect(report.shotsPerCartridge).toBeLessThan(
      DEFAULT_SHOT.cartridgeMl / (volumeMl * 0.25),
    );
  });

  it("does not flag a non-setting fizz reaction as a cartridge clog", () => {
    const fizz = checkCartridge(
      "B",
      [
        { id: "sodium-bicarbonate", pct: 10 },
        { id: "acetic-acid", pct: 10 },
        { id: "water", pct: 80 },
      ],
      DEFAULT_CONDITIONS,
    );
    expect(fizz.result?.setSeconds).toBe(0);
    expect(
      fizz.result?.events.find((event) => event.id === "bicarbonate-bubbles")
        ?.activity,
    ).toBeGreaterThan(0);
    expect(fizz.issue).toBeNull();
  });
});
