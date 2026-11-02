"use client";

import { useCallback, useEffect, useState } from "react";
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
  ready: boolean;
  save(ingredient: BenchIngredient): void;
  saveMany(ingredients: BenchIngredient[]): BenchIngredient[];
  remove(id: string): void;
} {
  const [list, setList] = useState<BenchIngredient[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setList(loadCustomIngredients());
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: BenchIngredient[]) => {
    localStorage.setItem(CUSTOM_STORAGE, JSON.stringify(next));
    setCustomIngredients(next);
    setList(next);
  }, []);

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

  const saveMany = useCallback((ingredients: BenchIngredient[]) => {
    const next = [...list];
    for (const ingredient of ingredients) {
      const existingIndex = next.findIndex((item) => item.id === ingredient.id);
      if (existingIndex >= 0) {
        next[existingIndex] = ingredient;
      } else if (next.length < MAX_CUSTOM_INGREDIENTS) {
        next.push(ingredient);
      }
    }
    persist(next);
    return next;
  }, [list, persist]);

  function remove(id: string) {
    persist(list.filter((ingredient) => ingredient.id !== id));
  }

  return { list, ready, save, saveMany, remove };
}
