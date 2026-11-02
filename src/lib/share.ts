import { INGREDIENTS } from "./ingredients";
import { benchLibrary } from "./bench/library";
import { DEFAULT_CONDITIONS } from "./bench/conditions";
import { parseStoredCustom } from "./bench/custom";
import { PROJECTILES } from "./nuclearFusion";
import type { Part as FormulaPart } from "./formula";
import type {
  BenchIngredient,
  Conditions,
  Experiment,
  Part as BenchPart,
} from "./bench/types";

export type BenchTestId =
  | "shoot"
  | "stretch"
  | "heat"
  | "dissolve"
  | "stick"
  | "drop";

export type SharePayload =
  | {
      v: 1;
      kind: "bench";
      experiment: Experiment;
      custom?: BenchIngredient[];
      testId?: BenchTestId;
    }
  | {
      v: 1;
      kind: "nucleus";
      z: number;
      n: number;
      fusion?: { projectileId: string; beamLabMeV: number };
    }
  | { v: 1; kind: "formula"; parts: FormulaPart[] };

const BENCH_TEST_IDS = new Set<BenchTestId>([
  "shoot",
  "stretch",
  "heat",
  "dissolve",
  "stick",
  "drop",
]);
const BUILTIN_FORMULA_IDS = new Set(INGREDIENTS.map((ingredient) => ingredient.id));
const PROJECTILE_IDS = new Set(PROJECTILES.map((projectile) => projectile.id));
const ATMOSPHERES = new Set(["air", "nitrogen", "vacuum"]);
const FORMING_METHODS = new Set([
  "beaker",
  "extrude-air",
  "extrude-bath",
  "cast-film",
  "heat-cure",
]);
const MAX_ENCODED_LENGTH = 12_000;

export function isBenchTestId(value: unknown): value is BenchTestId {
  return typeof value === "string" && BENCH_TEST_IDS.has(value as BenchTestId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string | null {
  if (
    value.length > MAX_ENCODED_LENGTH ||
    !/^[A-Za-z0-9_-]*$/.test(value) ||
    value.length % 4 === 1
  ) {
    return null;
  }

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function clampPercentage(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function sanitizeParts(
  raw: unknown,
  knownIds: Set<string>,
  dropped: Set<string>,
): BenchPart[] {
  if (!Array.isArray(raw)) return [];
  const parts: BenchPart[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    if (!knownIds.has(item.id)) {
      dropped.add(item.id);
      continue;
    }
    parts.push({ id: item.id, pct: clampPercentage(item.pct) });
  }
  return parts;
}

function numericCondition(
  conditions: Record<string, unknown>,
  key: keyof Pick<
    Conditions,
    "tempC" | "pressureKPa" | "humidityPct" | "mixRpm" | "mixMinutes" | "cureMinutes"
  >,
  min: number,
  max: number,
): number {
  const value = conditions[key];
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  ) {
    return value;
  }
  return DEFAULT_CONDITIONS[key];
}

function sanitizeConditions(raw: unknown, ingredients: Map<string, BenchIngredient>): Conditions {
  const conditions = isRecord(raw) ? raw : {};
  const rawBathId = conditions.bathId;
  const bath = typeof rawBathId === "string" ? ingredients.get(rawBathId) : undefined;
  const bathId =
    bath && (bath.category === "salt" || bath.category === "solvent")
      ? bath.id
      : DEFAULT_CONDITIONS.bathId;

  return {
    tempC: numericCondition(conditions, "tempC", -20, 200),
    pressureKPa: numericCondition(conditions, "pressureKPa", 0.1, 300),
    atmosphere: ATMOSPHERES.has(String(conditions.atmosphere))
      ? (conditions.atmosphere as Conditions["atmosphere"])
      : DEFAULT_CONDITIONS.atmosphere,
    humidityPct: numericCondition(conditions, "humidityPct", 0, 100),
    mixRpm: numericCondition(conditions, "mixRpm", 0, 3000),
    mixMinutes: numericCondition(conditions, "mixMinutes", 0, 240),
    cureMinutes: numericCondition(conditions, "cureMinutes", 0, 1440),
    forming: FORMING_METHODS.has(String(conditions.forming))
      ? (conditions.forming as Conditions["forming"])
      : DEFAULT_CONDITIONS.forming,
    ...(bathId === undefined ? {} : { bathId }),
  };
}

function sanitizeBench(raw: Record<string, unknown>): {
  payload: SharePayload;
  dropped: string[];
} {
  const custom = parseStoredCustom(raw.custom);
  const ingredients = new Map<string, BenchIngredient>(
    [...benchLibrary, ...custom].map(
      (ingredient): [string, BenchIngredient] => [ingredient.id, ingredient],
    ),
  );
  const knownIds = new Set(ingredients.keys());
  const dropped = new Set<string>();
  const rawExperiment = isRecord(raw.experiment) ? raw.experiment : {};
  const experiment: Experiment = {
    parts: sanitizeParts(rawExperiment.parts, knownIds, dropped),
    conditions: sanitizeConditions(rawExperiment.conditions, ingredients),
  };
  const testId =
    isBenchTestId(raw.testId) ? raw.testId : undefined;

  return {
    payload: {
      v: 1,
      kind: "bench",
      experiment,
      ...(custom.length ? { custom } : {}),
      ...(testId ? { testId } : {}),
    },
    dropped: [...dropped],
  };
}

function sanitizeInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeNucleus(raw: Record<string, unknown>): {
  payload: SharePayload;
  dropped: string[];
} {
  const z = sanitizeInteger(raw.z, 1, 200, 1);
  const n = sanitizeInteger(raw.n, 0, 320, 0);
  const fusion = isRecord(raw.fusion) ? raw.fusion : undefined;
  const projectileId = fusion?.projectileId;
  const beamLabMeV = fusion?.beamLabMeV;
  const validFusion =
    typeof projectileId === "string" &&
    PROJECTILE_IDS.has(projectileId) &&
    typeof beamLabMeV === "number" &&
    Number.isFinite(beamLabMeV) &&
    beamLabMeV >= 0.001 &&
    beamLabMeV <= 2000;

  return {
    payload: {
      v: 1,
      kind: "nucleus",
      z,
      n,
      ...(validFusion ? { fusion: { projectileId, beamLabMeV } } : {}),
    },
    dropped: [],
  };
}

function sanitizeFormula(raw: Record<string, unknown>): {
  payload: SharePayload;
  dropped: string[];
} {
  const dropped = new Set<string>();
  const parts = sanitizeParts(raw.parts, BUILTIN_FORMULA_IDS, dropped);
  return {
    payload: { v: 1, kind: "formula", parts },
    dropped: [...dropped],
  };
}

export function encodeShare(payload: SharePayload): string {
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeShare(
  value: string,
): { payload: SharePayload; dropped: string[] } | null {
  const json = base64UrlDecode(value);
  if (json === null) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed) || parsed.v !== 1) return null;
    if (parsed.kind === "bench") return sanitizeBench(parsed);
    if (parsed.kind === "nucleus") return sanitizeNucleus(parsed);
    if (parsed.kind === "formula") return sanitizeFormula(parsed);
    return null;
  } catch {
    return null;
  }
}

export function shareUrl(origin: string, path: string, payload: SharePayload): string {
  return `${origin}${path}#share=${encodeShare(payload)}`;
}

export function readShareHash(hash: string): string | null {
  const match = /^#share=(.*)$/.exec(hash);
  return match ? match[1] : null;
}
