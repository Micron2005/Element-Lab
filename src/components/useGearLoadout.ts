"use client";

import { useSyncExternalStore } from "react";
import { GEAR_CHANGE_EVENT, GEAR_KEY, parseGear, type GearLoadout } from "@/lib/play/rewards";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(GEAR_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(GEAR_CHANGE_EVENT, onChange);
  };
}

export function useGearLoadout(): GearLoadout {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(GEAR_KEY), () => null);
  return parseGear(raw);
}
