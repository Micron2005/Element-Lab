import { benchLibrary } from "../bench/library";
import { REACTIONS } from "../bench/reactions";
import type { Hazard, Product } from "../bench/types";
import { KNOWN_MOLECULES } from "./molecule";
import type { MixTargets, NucleusTargets, QuestTemplate } from "./templates";

export interface QuestPack {
  id: string;
  title: string;
  author?: string;
  quests: QuestTemplate[];
  createdAt: string;
}

export interface PackContents {
  title: string;
  author?: string;
  quests: QuestTemplate[];
}

export const PACKS_KEY = "elementlab.packs";
export const PACKS_CHANGE_EVENT = "elementlab-packs-change";
export const MAX_PACKS = 30;
const MAX_QUESTS = 10;
const INGREDIENT_IDS = new Set(benchLibrary.map(({ id }) => id));
const MOLECULE_IDS = new Set(KNOWN_MOLECULES.map(({ id }) => id));
const EVENT_IDS = new Set(REACTIONS.map(({ id }) => id));
const PRODUCTS = new Set<Product>([
  "nothing", "solution", "gel", "slime", "fiber", "film", "adhesive", "solid", "clumps", "dangerous",
]);
const HAZARDS = new Set<Hazard>([0, 1, 2, 3]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number, required = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, max);
  if (text || required) return text;
  return undefined;
}

function finiteClamped(value: unknown, min: number, max: number, integer = false): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.max(min, Math.min(max, value));
  return integer ? Math.round(clamped) : clamped;
}

function cleanStringIds(
  value: unknown,
  allowed: Set<string>,
  dropped: Set<string>,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!allowed.has(item)) dropped.add(item);
    else result.add(item);
  }
  return result.size ? [...result] : undefined;
}

function cleanTextFields(raw: Record<string, unknown>) {
  const story = cleanText(raw.story, 300);
  const hint = cleanText(raw.hint, 300);
  return {
    ...(story ? { story } : {}),
    ...(hint ? { hint } : {}),
  };
}

function sanitizeMixTargets(raw: unknown, dropped: Set<string>): MixTargets | null {
  if (!isRecord(raw)) return null;
  const product = Array.isArray(raw.product)
    ? [...new Set(raw.product.filter((value): value is Product => typeof value === "string" && PRODUCTS.has(value as Product)))]
    : [];
  const mustInclude = cleanStringIds(raw.mustInclude, INGREDIENT_IDS, dropped);
  const mustHappen = cleanStringIds(raw.mustHappen, EVENT_IDS, dropped);
  const minStrengthMPa = finiteClamped(raw.minStrengthMPa, 0, 5000);
  const minStretchPct = finiteClamped(raw.minStretchPct, 0, 5000);
  const minTack = finiteClamped(raw.minTack, 0, 10);
  const maxCostPerKg = finiteClamped(raw.maxCostPerKg, 0, 10000);
  const maxHazard = typeof raw.maxHazard === "number" && HAZARDS.has(raw.maxHazard as Hazard)
    ? raw.maxHazard as Hazard
    : undefined;
  const targets: MixTargets = {
    ...(product.length ? { product } : {}),
    ...(minStrengthMPa !== undefined ? { minStrengthMPa } : {}),
    ...(minStretchPct !== undefined ? { minStretchPct } : {}),
    ...(minTack !== undefined ? { minTack } : {}),
    ...(maxCostPerKg !== undefined ? { maxCostPerKg } : {}),
    ...(maxHazard !== undefined ? { maxHazard } : {}),
    ...(mustHappen ? { mustHappen } : {}),
    ...(mustInclude ? { mustInclude } : {}),
  };
  return Object.keys(targets).length ? targets : null;
}

function sanitizeNucleusTargets(raw: unknown): NucleusTargets | null {
  if (!isRecord(raw)) return null;
  const z = finiteClamped(raw.z, 1, 300, true);
  const minZ = finiteClamped(raw.minZ, 1, 300, true);
  const minHalfLifeS = finiteClamped(raw.minHalfLifeS, 0, 1e20);
  const targets: NucleusTargets = {
    ...(z !== undefined ? { z } : {}),
    ...(minZ !== undefined ? { minZ } : {}),
    ...(typeof raw.bound === "boolean" ? { bound: raw.bound } : {}),
    ...(minHalfLifeS !== undefined ? { minHalfLifeS } : {}),
  };
  return Object.keys(targets).length ? targets : null;
}

export function sanitizeQuestTemplate(raw: unknown, dropped = new Set<string>()): QuestTemplate | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  const fields = cleanTextFields(raw);
  if (raw.type === "molecule") {
    if (typeof raw.moleculeId !== "string" || !MOLECULE_IDS.has(raw.moleculeId)) {
      if (typeof raw.moleculeId === "string") dropped.add(raw.moleculeId);
      return null;
    }
    const title = cleanText(raw.title, 80);
    return {
      type: "molecule",
      moleculeId: raw.moleculeId,
      ...fields,
      ...(title ? { title } : {}),
    };
  }
  const title = cleanText(raw.title, 80, true);
  if (!title) return null;
  if (raw.type === "mix") {
    const targets = sanitizeMixTargets(raw.targets, dropped);
    return targets ? { type: "mix", title, ...fields, targets } : null;
  }
  if (raw.type === "nucleus") {
    const targets = sanitizeNucleusTargets(raw.targets);
    return targets ? { type: "nucleus", title, ...fields, targets } : null;
  }
  return null;
}

export function sanitizePackContents(raw: unknown): { pack: PackContents; dropped: string[] } | null {
  if (!isRecord(raw) || typeof raw.title !== "string" || !Array.isArray(raw.quests)) return null;
  if (raw.quests.length < 1 || raw.quests.length > MAX_QUESTS) return null;
  const title = cleanText(raw.title, 80, true);
  if (!title) return null;
  const author = cleanText(raw.author, 40);
  const dropped = new Set<string>();
  const quests = raw.quests
    .map((quest) => sanitizeQuestTemplate(quest, dropped))
    .filter((quest): quest is QuestTemplate => quest !== null);
  if (quests.length === 0) return null;
  return {
    pack: { title, ...(author ? { author } : {}), quests },
    dropped: [...dropped],
  };
}

function hashContent(contents: PackContents): string {
  const input = JSON.stringify({
    title: contents.title,
    ...(contents.author ? { author: contents.author } : {}),
    quests: contents.quests,
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `p${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizePack(raw: unknown): QuestPack | null {
  if (!isRecord(raw) || typeof raw.createdAt !== "string") return null;
  const contents = sanitizePackContents(raw);
  if (!contents) return null;
  const id = hashContent(contents.pack);
  if (typeof raw.id !== "string" || raw.id !== id) return null;
  return { id, ...contents.pack, createdAt: raw.createdAt };
}

export function loadPacks(rawValue?: string): QuestPack[] {
  if (rawValue === undefined && typeof window === "undefined") return [];
  try {
    const raw = rawValue ?? window.localStorage.getItem(PACKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePack)
      .filter((pack): pack is QuestPack => pack !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_PACKS);
  } catch {
    return [];
  }
}

export function savePack(raw: PackContents, now = new Date()): QuestPack | null {
  const contents = sanitizePackContents(raw);
  if (!contents) return null;
  const id = hashContent(contents.pack);
  const packs = loadPacks();
  const existing = packs.find((pack) => pack.id === id);
  if (existing) return existing;
  const pack: QuestPack = { id, ...contents.pack, createdAt: now.toISOString() };
  const next = [pack, ...packs].slice(0, MAX_PACKS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PACKS_KEY, JSON.stringify(next));
    } catch {
      return pack;
    }
    window.dispatchEvent?.(new Event(PACKS_CHANGE_EVENT));
  }
  return pack;
}

export function deletePack(id: string): QuestPack[] {
  const next = loadPacks().filter((pack) => pack.id !== id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PACKS_KEY, JSON.stringify(next));
    } catch {
      return next;
    }
    window.dispatchEvent?.(new Event(PACKS_CHANGE_EVENT));
  }
  return next;
}

export function packId(contents: PackContents): string | null {
  const normalized = sanitizePackContents(contents);
  return normalized ? hashContent(normalized.pack) : null;
}
