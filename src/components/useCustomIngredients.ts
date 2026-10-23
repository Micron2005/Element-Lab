"use client";

import { useEffect, useState } from "react";
import {
  CUSTOM_STORAGE,
  parseStoredCustom,
} from "@/lib/bench/custom";
import { setCustomIngredients } from "@/lib/bench/library";
import type { BenchIngredient } from "@/lib/bench/types";

const MAX_CUSTOM_INGREDIENTS = 100;

export function loadCustomIngredients(): BenchIngredient[] {
  let list: BenchIngredient[] = [];
  try {
    const stored = localStorage.getItem(CUSTOM_STORAGE);
    if (stored !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stored);
      } catch {
        localStorage.removeItem(CUSTOM_STORAGE);
        parsed = [];
      }
      list = parseStoredCustom(parsed).slice(0, MAX_CUSTOM_INGREDIENTS);
    }
  } catch {
    list = [];
  }
  setCustomIngredients(list);
  return list;
}

export function useCustomIngredients(): {
  list: BenchIngredient[];
  save(ingredient: BenchIngredient): void;
  remove(id: string): void;
} {
  const [list, setList] = useState<BenchIngredient[]>([]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setList(loadCustomIngredients());
    });
    return () => {
      active = false;
    };
  }, []);

  function persist(next: BenchIngredient[]) {
    localStorage.setItem(CUSTOM_STORAGE, JSON.stringify(next));
    setCustomIngredients(next);
    setList(next);
  }

  function save(ingredient: BenchIngredient) {
    const existing = list.some((item) => item.id === ingredient.id);
    if (!existing && list.length >= MAX_CUSTOM_INGREDIENTS) {
      throw new Error("You can save up to 100 custom ingredients.");
    }
    const next = existing
      ? list.map((item) => (item.id === ingredient.id ? ingredient : item))
      : [...list, ingredient];
    persist(next);
  }

  function remove(id: string) {
    persist(list.filter((ingredient) => ingredient.id !== id));
  }

  return { list, save, remove };
}
