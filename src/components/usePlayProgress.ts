"use client";

import { useMemo, useSyncExternalStore } from "react";
import { PROGRESS_KEY, loadProgress, recordStars, type PlayProgress } from "@/lib/play/progress";
import type { Stars } from "@/lib/play/quests";

const CHANGE_EVENT = "elementlab-play-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function usePlayProgress(): PlayProgress {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(PROGRESS_KEY) ?? "",
    () => "",
  );
  return useMemo(() => (raw ? loadProgress() : { stars: {} }), [raw]);
}

export function awardStars(questId: string, stars: Stars) {
  recordStars(questId, stars);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useQuestParam(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("quest"),
    () => null,
  );
}
