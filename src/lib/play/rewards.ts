import type { DailyProgress } from "./daily";
import { DAILY_POOL, dailyFor } from "./daily";
import type { PlayProgress } from "./progress";
import type { Stars } from "./quests";
import type { MessageKey } from "../i18n";

export const RANKS = [
  { id: "rookie", titleKey: "play.reward.rank.rookie", threshold: 0 },
  { id: "apprentice", titleKey: "play.reward.rank.apprentice", threshold: 50 },
  { id: "tech", titleKey: "play.reward.rank.tech", threshold: 150 },
  { id: "researcher", titleKey: "play.reward.rank.researcher", threshold: 300 },
  { id: "scientist", titleKey: "play.reward.rank.scientist", threshold: 500 },
  { id: "senior", titleKey: "play.reward.rank.senior", threshold: 800 },
  { id: "director", titleKey: "play.reward.rank.director", threshold: 1200 },
  { id: "nobel", titleKey: "play.reward.rank.nobel", threshold: 1800 },
] as const;

export function xpFor(progress: PlayProgress, daily: DailyProgress, weekly: WeeklyProgress): number {
  const questStars = Object.values(progress.stars).reduce<number>((sum, stars) => sum + stars, 0);
  const dailyStars = Object.values(daily.done).reduce<number>((sum, stars) => sum + stars, 0);
  return questStars * 10 + dailyStars * 5 + completedWeeklySets(weekly) * 50;
}

export function rankFor(xp: number) {
  const points = Math.max(0, Math.floor(xp));
  let index = RANKS.findIndex((rank, next) => points < (RANKS[next + 1]?.threshold ?? Infinity));
  if (index < 0) index = RANKS.length - 1;
  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const earned = points - current.threshold;
  const needed = next ? next.threshold - current.threshold : 0;
  return {
    current,
    next,
    progress: next ? Math.min(1, earned / needed) : 1,
    earned,
    needed,
  };
}

export interface RewardState {
  progress: PlayProgress;
  daily: DailyProgress;
  weekly: WeeklyProgress;
  today: string;
  playedPack: boolean;
}

export interface Badge {
  id: string;
  titleKey: MessageKey;
  descKey: MessageKey;
  icon: "molecule" | "stars" | "mix" | "atom" | "streak" | "week" | "pack" | "daily";
  earned(state: RewardState): boolean;
}

const moleculeIds = ["molecule-hydrogen", "molecule-water", "molecule-oxygen", "molecule-carbon-dioxide", "molecule-methane", "molecule-ammonia", "molecule-nitrogen", "molecule-hydrogen-peroxide", "molecule-ethylene", "molecule-hydrogen-cyanide", "molecule-ethanol", "molecule-acetic-acid"];
const mixIds = ["mix-fizz", "mix-slime", "mix-vanishing-film", "mix-sticky-situation", "mix-strand", "mix-enzyme-helper"];
const nucleusIds = ["atom-split", "atom-tightest", "atom-alpha", "atom-new-element"];
const hasStar = (state: RewardState, id: string, minimum: Stars = 1) => (state.progress.stars[id] ?? 0) >= minimum;

export const BADGES: readonly Badge[] = [
  { id: "first-molecule", titleKey: "play.reward.badge.firstMolecule", descKey: "play.reward.badge.firstMoleculeDesc", icon: "molecule", earned: (s) => moleculeIds.some((id) => hasStar(s, id)) },
  { id: "molecule-master", titleKey: "play.reward.badge.moleculeMaster", descKey: "play.reward.badge.moleculeMasterDesc", icon: "molecule", earned: (s) => moleculeIds.every((id) => hasStar(s, id)) },
  { id: "five-three-stars", titleKey: "play.reward.badge.fiveThreeStars", descKey: "play.reward.badge.fiveThreeStarsDesc", icon: "stars", earned: (s) => Object.values(s.progress.stars).filter((stars) => stars === 3).length >= 5 },
  { id: "all-mixing", titleKey: "play.reward.badge.allMixing", descKey: "play.reward.badge.allMixingDesc", icon: "mix", earned: (s) => mixIds.every((id) => hasStar(s, id)) },
  { id: "first-nuclear", titleKey: "play.reward.badge.firstNuclear", descKey: "play.reward.badge.firstNuclearDesc", icon: "atom", earned: (s) => nucleusIds.some((id) => hasStar(s, id)) },
  { id: "streak-3", titleKey: "play.reward.badge.streak3", descKey: "play.reward.badge.streak3Desc", icon: "streak", earned: (s) => dailyStreak(s.daily.done, s.today) >= 3 },
  { id: "streak-7", titleKey: "play.reward.badge.streak7", descKey: "play.reward.badge.streak7Desc", icon: "streak", earned: (s) => dailyStreak(s.daily.done, s.today) >= 7 },
  { id: "streak-30", titleKey: "play.reward.badge.streak30", descKey: "play.reward.badge.streak30Desc", icon: "streak", earned: (s) => dailyStreak(s.daily.done, s.today) >= 30 },
  { id: "first-weekly", titleKey: "play.reward.badge.firstWeekly", descKey: "play.reward.badge.firstWeeklyDesc", icon: "week", earned: (s) => completedWeeklySets(s.weekly) > 0 },
  { id: "first-daily", titleKey: "play.reward.badge.firstDaily", descKey: "play.reward.badge.firstDailyDesc", icon: "daily", earned: (s) => Object.values(s.daily.done).some((stars) => stars > 0) },
  { id: "first-pack", titleKey: "play.reward.badge.firstPack", descKey: "play.reward.badge.firstPackDesc", icon: "pack", earned: (s) => s.playedPack },
  { id: "nuclear-set", titleKey: "play.reward.badge.nuclearSet", descKey: "play.reward.badge.nuclearSetDesc", icon: "atom", earned: (s) => nucleusIds.every((id) => hasStar(s, id)) },
];

function dailyStreak(done: Record<string, Stars>, today: string): number {
  const date = new Date(`${today}T00:00:00Z`);
  let key = today;
  if ((done[key] ?? 0) < 1) date.setUTCDate(date.getUTCDate() - 1);
  let count = 0;
  for (;;) {
    key = date.toISOString().slice(0, 10);
    if ((done[key] ?? 0) < 1) return count;
    count += 1;
    date.setUTCDate(date.getUTCDate() - 1);
  }
}

export function earnedBadges(state: RewardState): Badge[] {
  return BADGES.filter((badge) => badge.earned(state));
}

export interface WeeklyProgress {
  done: Record<string, Stars>;
}

export const WEEKLY_PROGRESS_KEY = "elementlab.weekly";
export const WEEKLY_CHANGE_EVENT = "elementlab-weekly-change";

export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function weeklyFor(week: string, todayKey = ""): { id: string; template: (typeof DAILY_POOL)[number] }[] {
  const indices = DAILY_POOL.map((_item, index) => index).sort((a, b) => hash(`${week}:${a}`) - hash(`${week}:${b}`));
  const matched = /^(\d{4})-W(\d{2})$/.exec(week);
  const excluded = new Set<string>();
  if (matched) {
    const jan4 = new Date(Date.UTC(Number(matched[1]), 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(matched[2]) - 1) * 7);
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + day);
      excluded.add(JSON.stringify(dailyFor(date.toISOString().slice(0, 10)).template));
    }
  } else if (todayKey) {
    excluded.add(JSON.stringify(dailyFor(todayKey).template));
  }
  const selected = indices.filter((index) => !excluded.has(JSON.stringify(DAILY_POOL[index]))).slice(0, 3);
  return selected.map((index, position) => ({ id: `weekly:${week}:${position}`, template: DAILY_POOL[index] }));
}

export function loadWeeklyProgress(): WeeklyProgress {
  if (typeof window === "undefined") return { done: {} };
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(WEEKLY_PROGRESS_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || !("done" in parsed) || !parsed.done || typeof parsed.done !== "object") return { done: {} };
    const done: Record<string, Stars> = {};
    for (const [key, value] of Object.entries(parsed.done)) if (value === 1 || value === 2 || value === 3) done[key] = value;
    return { done };
  } catch {
    return { done: {} };
  }
}

export function recordWeekly(id: string, stars: Stars): WeeklyProgress {
  const progress = loadWeeklyProgress();
  const next = { done: { ...progress.done, [id]: Math.max(progress.done[id] ?? 0, stars) as Stars } };
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(WEEKLY_PROGRESS_KEY, JSON.stringify(next)); } catch { return next; }
    window.dispatchEvent(new Event(WEEKLY_CHANGE_EVENT));
  }
  return next;
}

export function completedWeeklySets(progress: WeeklyProgress): number {
  const weeks = new Set(Object.keys(progress.done).map((key) => key.split(":")[1]).filter(Boolean));
  let count = 0;
  for (const week of weeks) {
    const items = weeklyFor(week, "");
    if (items.every(({ id }) => (progress.done[id] ?? 0) >= 1)) count += 1;
  }
  return count;
}

export const GEAR = {
  coats: [{ id: "white", rank: 0 }, { id: "teal", rank: 1 }, { id: "purple", rank: 3 }, { id: "orange", rank: 5 }, { id: "black", rank: 7 }],
  goggles: [{ id: "classic", rank: 0 }, { id: "round", rank: 2 }, { id: "visor", rank: 5 }],
  boards: [{ id: "grid", rank: 0 }, { id: "dots", rank: 2 }, { id: "blueprint", rank: 4 }, { id: "space", rank: 7 }],
} as const;

export function unlockedGear(rankIndex: number) {
  return {
    coats: GEAR.coats.filter((item) => item.rank <= rankIndex).map(({ id }) => id),
    goggles: GEAR.goggles.filter((item) => item.rank <= rankIndex).map(({ id }) => id),
    boards: GEAR.boards.filter((item) => item.rank <= rankIndex).map(({ id }) => id),
  };
}

export type GearLoadout = {
  coat: (typeof GEAR.coats)[number]["id"];
  goggles: (typeof GEAR.goggles)[number]["id"];
  board: (typeof GEAR.boards)[number]["id"];
};

export const GEAR_KEY = "elementlab.gear";
export const GEAR_CHANGE_EVENT = "elementlab-gear-change";
export const DEFAULT_GEAR: GearLoadout = { coat: "white", goggles: "classic", board: "grid" };

export function parseGear(raw: string | null): GearLoadout {
  if (!raw) return { ...DEFAULT_GEAR };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...DEFAULT_GEAR };
    const candidate = value as Record<string, unknown>;
    return {
      coat: GEAR.coats.some(({ id }) => id === candidate.coat) ? candidate.coat as GearLoadout["coat"] : "white",
      goggles: GEAR.goggles.some(({ id }) => id === candidate.goggles) ? candidate.goggles as GearLoadout["goggles"] : "classic",
      board: GEAR.boards.some(({ id }) => id === candidate.board) ? candidate.board as GearLoadout["board"] : "grid",
    };
  } catch {
    return { ...DEFAULT_GEAR };
  }
}

export function loadGear(): GearLoadout {
  if (typeof window === "undefined") return { ...DEFAULT_GEAR };
  try {
    return parseGear(window.localStorage.getItem(GEAR_KEY));
  } catch {
    return { ...DEFAULT_GEAR };
  }
}

export function saveGear(loadout: GearLoadout): void {
  if (typeof window === "undefined") return;
  const next = parseGear(JSON.stringify(loadout));
  try { window.localStorage.setItem(GEAR_KEY, JSON.stringify(next)); } catch { /* Keep this selection usable in memory. */ }
  window.dispatchEvent(new Event(GEAR_CHANGE_EVENT));
}
