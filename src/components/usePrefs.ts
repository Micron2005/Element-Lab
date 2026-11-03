"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFS,
  loadPrefs,
  PREFS_CHANGE_EVENT,
  type Prefs,
} from "@/lib/prefs";

let cachedPrefs: Prefs | null = null;

function getSnapshot() {
  if (!cachedPrefs) cachedPrefs = loadPrefs();
  return cachedPrefs;
}

function subscribe(onChange: () => void) {
  const update = () => {
    cachedPrefs = loadPrefs();
    onChange();
  };
  window.addEventListener(PREFS_CHANGE_EVENT, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(PREFS_CHANGE_EVENT, update);
    window.removeEventListener("storage", update);
  };
}

export function usePrefs() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PREFS);
}
