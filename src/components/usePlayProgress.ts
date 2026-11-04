"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { PROGRESS_KEY, loadProgress, recordStars, type PlayProgress } from "@/lib/play/progress";
import { DAILY_PROGRESS_KEY, loadDailyProgress, recordDaily, type DailyProgress } from "@/lib/play/daily";
import { WEEKLY_CHANGE_EVENT, WEEKLY_PROGRESS_KEY, loadWeeklyProgress, recordWeekly, type WeeklyProgress } from "@/lib/play/rewards";
import { PACKS_CHANGE_EVENT, PACKS_KEY } from "@/lib/play/packs";
import type { Stars } from "@/lib/play/quests";

const CHANGE_EVENT = "elementlab-play-change";
const DAILY_CHANGE_EVENT = "elementlab-daily-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener(PACKS_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener(PACKS_CHANGE_EVENT, onChange);
  };
}

function subscribeDaily(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DAILY_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DAILY_CHANGE_EVENT, onChange);
  };
}

function subscribeWeekly(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(WEEKLY_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(WEEKLY_CHANGE_EVENT, onChange);
  };
}

export function usePlayProgress(): PlayProgress {
  const raw = useSyncExternalStore(
    subscribe,
    () => `${localStorage.getItem(PROGRESS_KEY) ?? ""}|${localStorage.getItem(PACKS_KEY) ?? ""}`,
    () => "",
  );
  return useMemo(() => (raw ? loadProgress() : { stars: {} }), [raw]);
}

export function useDailyProgress(): DailyProgress {
  const raw = useSyncExternalStore(
    subscribeDaily,
    () => localStorage.getItem(DAILY_PROGRESS_KEY) ?? "",
    () => "",
  );
  return useMemo(() => (raw ? loadDailyProgress() : { done: {} }), [raw]);
}

export function useWeeklyProgress(): WeeklyProgress {
  const raw = useSyncExternalStore(
    subscribeWeekly,
    () => localStorage.getItem(WEEKLY_PROGRESS_KEY) ?? "",
    () => "",
  );
  return useMemo(() => (raw ? loadWeeklyProgress() : { done: {} }), [raw]);
}

export function awardStars(questId: string, stars: Stars) {
  recordStars(questId, stars);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function awardDaily(key: string, stars: Stars) {
  recordDaily(key, stars);
  window.dispatchEvent(new Event(DAILY_CHANGE_EVENT));
}

export function awardWeekly(key: string, stars: Stars) {
  recordWeekly(key, stars);
}

export function useQuestParam(): string | null {
  return useSearchParams().get("quest");
}
