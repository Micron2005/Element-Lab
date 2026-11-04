import { DEFAULT_CONDITIONS } from "../bench/conditions";
import type { Experiment } from "../bench/types";
import type { Stars } from "./quests";
import type { QuestTemplate } from "./templates";
import { DEFAULT_LOCALE, tr, type Locale, type MessageKey } from "../i18n";

export const DAILY_PROGRESS_KEY = "elementlab.daily";

export interface DailyProgress {
  done: Record<string, Stars>;
}

export const DAILY_POOL: QuestTemplate[] = [
  { type: "molecule", moleculeId: "hydrogen-chloride" },
  { type: "molecule", moleculeId: "ethane" },
  { type: "molecule", moleculeId: "acetylene" },
  { type: "molecule", moleculeId: "methanol" },
  { type: "molecule", moleculeId: "dimethyl-ether" },
  { type: "molecule", moleculeId: "formaldehyde" },
  { type: "molecule", moleculeId: "formic-acid" },
  { type: "molecule", moleculeId: "hydrogen-sulfide" },
  {
    type: "mix",
    targets: { product: ["fiber"], minStrengthMPa: 0.5, maxCostPerKg: 2, maxHazard: 1 },
  },
  {
    type: "mix",
    targets: { product: ["film"], mustInclude: ["chitosan"] },
  },
  {
    type: "mix",
    targets: { product: ["adhesive"], minTack: 1, mustInclude: ["mfp5"] },
  },
  {
    type: "mix",
    targets: { mustHappen: ["bicarbonate-bubbles"], mustInclude: ["sodium-bicarbonate"] },
  },
  {
    type: "mix",
    targets: { mustHappen: ["transglutaminase"], mustInclude: ["transglutaminase"] },
  },
  {
    type: "mix",
    targets: { minStrengthMPa: 1, mustInclude: ["sulfur"] },
  },
  {
    type: "mix",
    targets: { product: ["fiber"], minStrengthMPa: 5 },
  },
  {
    type: "mix",
    targets: { product: ["slime"], mustInclude: ["pva", "borax"] },
  },
  {
    type: "mix",
    targets: { mustHappen: ["protease-digestion"] },
  },
  {
    type: "nucleus",
    targets: { z: 26, bound: true, minHalfLifeS: 1e12 },
  },
  {
    type: "nucleus",
    targets: { minZ: 114, bound: true },
  },
  {
    type: "nucleus",
    targets: { z: 92, bound: true, minHalfLifeS: 1e6 },
  },
  {
    type: "nucleus",
    targets: { z: 2, bound: true, minHalfLifeS: 1e3 },
  },
];

const DAILY_MESSAGE_KEYS: Partial<Record<number, { title: MessageKey; story: MessageKey }>> = {
  8: { title: "play.ui.dailyTitle.8", story: "play.ui.dailyStory.8" },
  9: { title: "play.ui.dailyTitle.9", story: "play.ui.dailyStory.9" },
  10: { title: "play.ui.dailyTitle.10", story: "play.ui.dailyStory.10" },
  11: { title: "play.ui.dailyTitle.11", story: "play.ui.dailyStory.11" },
  12: { title: "play.ui.dailyTitle.12", story: "play.ui.dailyStory.12" },
  13: { title: "play.ui.dailyTitle.13", story: "play.ui.dailyStory.13" },
  14: { title: "play.ui.dailyTitle.14", story: "play.ui.dailyStory.14" },
  15: { title: "play.ui.dailyTitle.15", story: "play.ui.dailyStory.15" },
  16: { title: "play.ui.dailyTitle.16", story: "play.ui.dailyStory.16" },
  17: { title: "play.ui.dailyTitle.17", story: "play.ui.dailyStory.17" },
  18: { title: "play.ui.dailyTitle.18", story: "play.ui.dailyStory.18" },
  19: { title: "play.ui.dailyTitle.19", story: "play.ui.dailyStory.19" },
  20: { title: "play.ui.dailyTitle.20", story: "play.ui.dailyStory.20" },
};

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function shiftDay(key: string, amount: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function validKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && shiftDay(key, 0) === key;
}

export function dailyKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dailyFor(key: string, locale: Locale = DEFAULT_LOCALE): { id: string; template: QuestTemplate } {
  let index = hashString(key) % DAILY_POOL.length;
  if (validKey(key)) {
    const yesterdayIndex = hashString(shiftDay(key, -1)) % DAILY_POOL.length;
    if (index === yesterdayIndex) index = (index + 1) % DAILY_POOL.length;
  }
  const source = DAILY_POOL[index];
  const dailyKeys = DAILY_MESSAGE_KEYS[index];
  const template = source.type === "molecule" || !dailyKeys
    ? source
    : {
        ...source,
        title: tr(locale, dailyKeys.title),
        story: tr(locale, dailyKeys.story),
      };
  return { id: `daily:${key}`, template };
}

function isStars(value: unknown): value is Stars {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function loadDailyProgress(): DailyProgress {
  if (typeof window === "undefined") return { done: {} };
  try {
    const raw = window.localStorage.getItem(DAILY_PROGRESS_KEY);
    if (!raw) return { done: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("done" in parsed)) return { done: {} };
    const values = (parsed as { done?: unknown }).done;
    if (!values || typeof values !== "object" || Array.isArray(values)) return { done: {} };
    const done: Record<string, Stars> = {};
    for (const [key, stars] of Object.entries(values)) {
      if (validKey(key) && isStars(stars)) done[key] = stars;
    }
    return { done };
  } catch {
    return { done: {} };
  }
}

export function recordDaily(key: string, stars: Stars): DailyProgress {
  if (!validKey(key) || !isStars(stars)) return loadDailyProgress();
  const progress = loadDailyProgress();
  const next = { done: { ...progress.done, [key]: Math.max(progress.done[key] ?? 0, stars) as Stars } };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(next));
    } catch {
      return next;
    }
  }
  return next;
}

export function streak(done: Record<string, Stars>, todayKey: string): number {
  if (!validKey(todayKey)) return 0;
  let cursor = (done[todayKey] ?? 0) >= 1 ? todayKey : shiftDay(todayKey, -1);
  if ((done[cursor] ?? 0) < 1) return 0;
  let count = 0;
  while ((done[cursor] ?? 0) >= 1) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

export function emptyMixReference(): Experiment {
  return { parts: [], conditions: { ...DEFAULT_CONDITIONS } };
}
