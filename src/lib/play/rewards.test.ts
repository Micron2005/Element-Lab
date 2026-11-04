import { describe, expect, it } from "vitest";
import { BADGES, GEAR, RANKS, completedWeeklySets, earnedBadges, isoWeekKey, rankFor, unlockedGear, weeklyFor, xpFor, type RewardState } from "./rewards";
import { dailyFor } from "./daily";
import type { Stars } from "./quests";

const empty: RewardState = { progress: { stars: {} }, daily: { done: {} }, weekly: { done: {} }, today: "2025-04-07", playedPack: false };

describe("derived rewards", () => {
  it("calculates XP from quest stars, daily stars, and complete weekly sets", () => {
    const week = "2025-W15";
    const done: Record<string, Stars> = Object.fromEntries(weeklyFor(week).map(({ id }) => [id, 1]));
    expect(xpFor({ stars: { "molecule-water": 2 } }, { done: { "2025-04-07": 3 } }, { done })).toBe(85);
    expect(completedWeeklySets({ done })).toBe(1);
  });

  it("reports exact rank boundaries and progress toward the next rank", () => {
    expect(rankFor(49)).toMatchObject({ current: RANKS[0], next: RANKS[1], progress: 49 / 50 });
    expect(rankFor(50)).toMatchObject({ current: RANKS[1], next: RANKS[2], progress: 0 });
    expect(rankFor(1800)).toMatchObject({ current: RANKS[7], next: null, progress: 1 });
  });

  it("evaluates each badge predicate from existing progress only", () => {
    const allStars: Record<string, 3> = {};
    for (const id of ["molecule-hydrogen", "molecule-water", "molecule-oxygen", "molecule-carbon-dioxide", "molecule-methane", "molecule-ammonia", "molecule-nitrogen", "molecule-hydrogen-peroxide", "molecule-ethylene", "molecule-hydrogen-cyanide", "molecule-ethanol", "molecule-acetic-acid", "mix-fizz", "mix-slime", "mix-vanishing-film", "mix-sticky-situation", "mix-strand", "mix-enzyme-helper", "atom-split", "atom-tightest", "atom-alpha", "atom-new-element"]) allStars[id] = 3;
    const daily: Record<string, Stars> = Object.fromEntries(Array.from({ length: 30 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 3, 7 - i)).toISOString().slice(0, 10);
      return [date, 1];
    }));
    const state: RewardState = {
      progress: { stars: allStars },
      daily: { done: daily },
      weekly: { done: Object.fromEntries(weeklyFor("2025-W15").map(({ id }) => [id, 1])) as Record<string, Stars> },
      today: "2025-04-07",
      playedPack: true,
    };
    expect(BADGES).toHaveLength(12);
    expect(BADGES.every(({ earned }) => earned(state))).toBe(true);
    expect(earnedBadges(state)).toHaveLength(BADGES.length);
    expect(BADGES.every(({ earned }) => !earned(empty))).toBe(true);
  });

  it("selects three deterministic, unique weekly templates and computes ISO week keys", () => {
    expect(isoWeekKey(new Date("2025-04-07T12:00:00Z"))).toBe("2025-W15");
    const first = weeklyFor("2025-W15", "2025-04-07");
    expect(weeklyFor("2025-W15", "2025-04-07")).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first.map(({ template }) => JSON.stringify(template))).size).toBe(3);
    expect(first.map(({ template }) => JSON.stringify(template))).not.toContain(JSON.stringify(dailyFor("2025-04-07").template));
  });

  it("unlocks only rank-eligible coats, goggles, and board backgrounds", () => {
    expect(unlockedGear(0)).toMatchObject({ coats: ["white"], goggles: ["classic"], boards: ["grid"] });
    expect(unlockedGear(7)).toMatchObject({
      coats: GEAR.coats.map(({ id }) => id),
      goggles: GEAR.goggles.map(({ id }) => id),
      boards: GEAR.boards.map(({ id }) => id),
    });
  });
});
