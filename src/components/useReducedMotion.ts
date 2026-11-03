"use client";

import { useSyncExternalStore } from "react";
import { usePrefs } from "./usePrefs";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion() {
  const systemReduced = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const prefs = usePrefs();
  return systemReduced || prefs.motion === "reduce";
}
