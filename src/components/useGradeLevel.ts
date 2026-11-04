"use client";

import { useSyncExternalStore } from "react";
import {
  GRADE_LEVEL_CHANGE_EVENT,
  GRADE_LEVEL_KEY,
  gradeLevelFromStorage,
  type GradeLevel,
} from "@/lib/play/levels";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(GRADE_LEVEL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(GRADE_LEVEL_CHANGE_EVENT, onChange);
  };
}

function getSnapshot() {
  return localStorage.getItem(GRADE_LEVEL_KEY) ?? "high";
}

export function useGradeLevel(): GradeLevel {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "high");
  return gradeLevelFromStorage(raw);
}
