import { describe, expect, it } from "vitest";
import { benchLibrary } from "./library";
import { findBestMixes, findBestMixesAsync } from "./optimize";
import type { Candidate } from "./types";

const strengthGoal = {
  minTensileMPa: 200,
  minElongationPct: 20,
  skinSafe: true,
};

function ingredientSet(candidate: Candidate): string {
  return candidate.experiment.parts.map((part) => part.id).sort().join("|");
}

describe("best-mix optimizer", () => {
  it("returns five sorted deterministic skin-safe candidates for a seeded search", () => {
    const options = {
      pool: benchLibrary.map((ingredient) => ingredient.id),
      maxIngredients: 4,
      budget: 1500,
      seed: 1,
    };
    const first = findBestMixes(strengthGoal, options);
    const second = findBestMixes(strengthGoal, options);

    expect(first).toHaveLength(5);
    expect(first.map((candidate) => candidate.score)).toEqual(
      [...first.map((candidate) => candidate.score)].sort((a, b) => a - b),
    );
    expect(new Set(first.map(ingredientSet)).size).toBe(5);
    expect(first).toEqual(second);
    expect(first.every((candidate) => candidate.result.skin <= 1)).toBe(true);
    expect(first.every((candidate) => candidate.result.curedToxicity <= 1)).toBe(true);
  });

  it("keeps every candidate inside a restricted ingredient pool", () => {
    const pool = ["alginate", "cacl2", "water", "glycerol"];
    const candidates = findBestMixes({}, {
      pool,
      maxIngredients: 4,
      budget: 400,
      seed: 9,
    });
    const allowed = new Set(pool);

    expect(candidates.length).toBeGreaterThan(0);
    expect(
      candidates.every((candidate) =>
        candidate.experiment.parts.every((part) => allowed.has(part.id)),
      ),
    ).toBe(true);
  });

  it("yields progress while running the chunked asynchronous search", async () => {
    const progress: number[] = [];
    const candidates = await findBestMixesAsync(
      {},
      { pool: ["spider-silk", "pva", "water", "glycerol"], maxIngredients: 4, budget: 90, seed: 4 },
      (completed) => progress.push(completed),
    );

    expect(candidates.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(90);
    expect(progress.length).toBeGreaterThan(1);
  });
});
