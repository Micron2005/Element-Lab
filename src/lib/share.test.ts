import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS } from "./bench/conditions";
import {
  CUSTOM_PREFIX,
  emptyDraft,
  validateCustomDraft,
} from "./bench/custom";
import type { BenchIngredient, Experiment } from "./bench/types";
import {
  decodeShare,
  encodeShare,
  readShareHash,
  shareUrl,
  type SharePayload,
} from "./share";

function ingredient(name: string): BenchIngredient {
  const result = validateCustomDraft(
    { ...emptyDraft(), name, density: "1.2" },
    `${CUSTOM_PREFIX}share-test`,
  );
  if (!("ingredient" in result)) throw new Error(JSON.stringify(result.errors));
  return result.ingredient;
}

function rawBase64Url(json: string): string {
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(payload: unknown) {
  return decodeShare(encodeShare(payload as SharePayload));
}

afterEach(() => {
  // Payload decoding uses only the built-in library and embedded custom data.
});

describe("share payloads", () => {
  it("round-trips a Bench experiment", () => {
    const experiment: Experiment = {
      parts: [{ id: "water", pct: 60 }, { id: "pva", pct: 40 }],
      conditions: { ...DEFAULT_CONDITIONS, tempC: 50, forming: "cast-film" },
    };
    expect(
      decode({ v: 1, kind: "bench", experiment, testId: "heat" }),
    ).toEqual({ payload: { v: 1, kind: "bench", experiment, testId: "heat" }, dropped: [] });
  });

  it("preserves Unicode names in embedded custom ingredients", () => {
    const custom = ingredient("Café gel ✓ 日本");
    const payload = {
      v: 1 as const,
      kind: "bench" as const,
      experiment: {
        parts: [{ id: custom.id, pct: 100 }],
        conditions: { ...DEFAULT_CONDITIONS },
      },
      custom: [custom],
    };
    expect(decode(payload)?.payload).toEqual(payload);
  });

  it("round-trips a nucleus and fusion settings", () => {
    const payload = {
      v: 1 as const,
      kind: "nucleus" as const,
      z: 20,
      n: 28,
      fusion: { projectileId: "ca48", beamLabMeV: 249.5 },
    };
    expect(decode(payload)).toEqual({ payload, dropped: [] });
  });

  it("round-trips a Lab formula", () => {
    const payload = {
      v: 1 as const,
      kind: "formula" as const,
      parts: [{ id: "spider-silk", pct: 70 }, { id: "borax", pct: 30 }],
    };
    expect(decode(payload)).toEqual({ payload, dropped: [] });
  });

  it("rejects garbage, invalid JSON, unsupported versions, and oversized values", () => {
    expect(decodeShare("%%%")).toBeNull();
    expect(decodeShare(rawBase64Url("{broken"))).toBeNull();
    expect(decodeShare(rawBase64Url(JSON.stringify({ v: 2, kind: "bench" })))).toBeNull();
    expect(decodeShare(rawBase64Url(JSON.stringify({ v: 1, kind: "unknown" })))).toBeNull();
    expect(decodeShare("a".repeat(12_001))).toBeNull();
  });

  it("drops and reports unknown ingredient IDs", () => {
    expect(
      decode({
        v: 1,
        kind: "bench",
        experiment: {
          parts: [{ id: "not-a-bench-ingredient", pct: 10 }, { id: "water", pct: 90 }],
          conditions: DEFAULT_CONDITIONS,
        },
      }),
    ).toEqual({
      payload: {
        v: 1,
        kind: "bench",
        experiment: {
          parts: [{ id: "water", pct: 90 }],
          conditions: DEFAULT_CONDITIONS,
        },
      },
      dropped: ["not-a-bench-ingredient"],
    });

    expect(
      decode({
        v: 1,
        kind: "formula",
        parts: [{ id: "unknown-formula-ingredient", pct: 10 }],
      }),
    ).toEqual({
      payload: { v: 1, kind: "formula", parts: [] },
      dropped: ["unknown-formula-ingredient"],
    });
  });

  it("clamps Bench percentages and defaults invalid conditions", () => {
    const result = decode({
      v: 1,
      kind: "bench",
      experiment: {
        parts: [{ id: "water", pct: 150 }],
        conditions: { ...DEFAULT_CONDITIONS, atmosphere: "argon" },
      },
    });
    expect(result?.payload).toMatchObject({
      kind: "bench",
      experiment: {
        parts: [{ id: "water", pct: 100 }],
        conditions: { atmosphere: "air" },
      },
    });
  });

  it("clamps nucleus counts to the allowed integer ranges", () => {
    expect(decode({ v: 1, kind: "nucleus", z: 999, n: -5 })?.payload).toEqual({
      v: 1,
      kind: "nucleus",
      z: 200,
      n: 0,
    });
  });

  it("drops invalid fusion settings", () => {
    expect(
      decode({
        v: 1,
        kind: "nucleus",
        z: 20,
        n: 28,
        fusion: { projectileId: "invalid", beamLabMeV: 250 },
      })?.payload,
    ).toEqual({ v: 1, kind: "nucleus", z: 20, n: 28 });
  });

  it("drops an unknown Bench test ID", () => {
    expect(
      decode({
        v: 1,
        kind: "bench",
        experiment: { parts: [{ id: "water", pct: 100 }], conditions: DEFAULT_CONDITIONS },
        testId: "not-a-test",
      })?.payload,
    ).toEqual({
      v: 1,
      kind: "bench",
      experiment: { parts: [{ id: "water", pct: 100 }], conditions: DEFAULT_CONDITIONS },
    });
  });

  it("builds share URLs and reads share hashes", () => {
    const payload = { v: 1 as const, kind: "nucleus" as const, z: 2, n: 2 };
    expect(shareUrl("https://example.test", "/elements", payload)).toBe(
      `https://example.test/elements#share=${encodeShare(payload)}`,
    );
    expect(readShareHash("#share=abc")).toBe("abc");
    expect(readShareHash("")).toBeNull();
    expect(readShareHash("#other")).toBeNull();
  });
});
