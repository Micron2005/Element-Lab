import { fmtTime } from "../formula";
import { benchById } from "./library";
import { REACTIONS } from "./reactions";
import {
  fluidFromMix,
  shootTest,
  type ShotReport,
  type ShotSetup,
} from "./shootTest";
import { simulate } from "./simulate";
import type { Conditions, Experiment, Part, RunResult } from "./types";

export interface TwoPartSetup {
  ratioA: number;
  ratioB: number;
}

export const DEFAULT_RATIO: TwoPartSetup = { ratioA: 1, ratioB: 1 };
export const CARTRIDGE_B_STORAGE = "elementlab.bench.cartridgeB";

export type CartridgeIssue =
  | "empty"
  | "no-liquid"
  | "sets-in-cartridge"
  | "unsafe"
  | null;

export interface CartridgeCheck {
  label: "A" | "B";
  issue: CartridgeIssue;
  message: string;
  result: RunResult | null;
  viscosityPas: number | null;
}

export interface TwoPartReport {
  a: CartridgeCheck;
  b: CartridgeCheck;
  combined: { experiment: Experiment; result: RunResult } | null;
  clogsNozzle: boolean;
  shot: ShotReport | null;
  shotsPerCartridge: number | null;
  headline: string;
}

function normalizedParts(parts: Part[]): Part[] {
  const positiveParts = parts.filter(
    (part) => Number.isFinite(part.pct) && part.pct > 0,
  );
  const total = positiveParts.reduce((sum, part) => sum + part.pct, 0);
  if (total <= 0) return [];
  return positiveParts.map((part) => ({
    id: part.id,
    pct: (part.pct / total) * 100,
  }));
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function ratioShares(ratio: TwoPartSetup): [number, number] {
  const ratioA = Number.isFinite(ratio.ratioA) ? Math.max(0, ratio.ratioA) : 0;
  const ratioB = Number.isFinite(ratio.ratioB) ? Math.max(0, ratio.ratioB) : 0;
  const ratioTotal = ratioA + ratioB;
  return ratioTotal > 0
    ? [ratioA / ratioTotal, ratioB / ratioTotal]
    : [0.5, 0.5];
}

export function combineAtTip(
  a: Experiment,
  bParts: Part[],
  ratio: TwoPartSetup,
): Experiment {
  const [shareA, shareB] = ratioShares(ratio);
  const combined: Part[] = [];
  const positions = new Map<string, number>();

  const addPart = (part: Part, share: number) => {
    const position = positions.get(part.id);
    if (position === undefined) {
      positions.set(part.id, combined.length);
      combined.push({ id: part.id, pct: part.pct * share });
    } else {
      combined[position].pct += part.pct * share;
    }
  };
  for (const part of normalizedParts(a.parts)) addPart(part, shareA);
  for (const part of normalizedParts(bParts)) addPart(part, shareB);

  const rounded = combined.map((part) => ({
    ...part,
    pct: roundTo(part.pct, 2),
  }));
  const total = rounded.reduce((sum, part) => sum + part.pct, 0);
  if (rounded.length > 0 && total !== 100) {
    let largestIndex = 0;
    for (let index = 1; index < rounded.length; index += 1) {
      if (rounded[index].pct > rounded[largestIndex].pct) largestIndex = index;
    }
    rounded[largestIndex].pct = roundTo(
      rounded[largestIndex].pct + (100 - total),
      2,
    );
  }

  return {
    parts: rounded,
    conditions: { ...a.conditions, forming: "extrude-air" },
  };
}

function viscosityText(viscosityPas: number): string {
  return String(Number(viscosityPas.toPrecision(3)));
}

function hasFastNetworkFormation(result: RunResult): boolean {
  return result.events.some((event) => {
    if (event.activity <= 0) return false;
    const reaction = REACTIONS.find((item) => item.id === event.id);
    return reaction !== undefined && reaction.network > 0;
  });
}

export function checkCartridge(
  label: "A" | "B",
  parts: Part[],
  conditions: Conditions,
): CartridgeCheck {
  const positiveParts = parts.filter(
    (part) => Number.isFinite(part.pct) && part.pct > 0,
  );
  if (positiveParts.length === 0) {
    return {
      label,
      issue: "empty",
      message: `Add ingredients to cartridge ${label}.`,
      result: null,
      viscosityPas: null,
    };
  }

  const experiment: Experiment = {
    parts: positiveParts,
    conditions: { ...conditions, forming: "beaker" },
  };
  const result = simulate(experiment);
  const viscosityPas = fluidFromMix(experiment, result).viscosityPas;
  const check = (
    issue: CartridgeIssue,
    message: string,
  ): CartridgeCheck => ({
    label,
    issue,
    message,
    result,
    viscosityPas,
  });

  if (result.product === "dangerous") {
    return check("unsafe", `Cartridge ${label} is unsafe to shoot.`);
  }
  if (viscosityPas === null) {
    return check("no-liquid", `Cartridge ${label} has no flowing liquid.`);
  }

  const fastSettingProduct = ["gel", "solid", "clumps", "slime"].includes(
    result.product,
  );
  const fastNetworkReaction = hasFastNetworkFormation(result);
  if (
    result.setSeconds > 0 &&
    result.setSeconds <= 30 &&
    (fastSettingProduct || fastNetworkReaction)
  ) {
    return check(
      "sets-in-cartridge",
      `Cartridge ${label} sets in about ${fmtTime(result.setSeconds)} on its own and would clog. Move the setting agent to the other cartridge.`,
    );
  }

  return check(
    null,
    `Stays liquid (${viscosityText(viscosityPas)} Pa·s).`,
  );
}

export function clogsAtTip(
  setSeconds: number,
  setup: Pick<ShotSetup, "nozzleLengthMm" | "speedMs">,
): boolean {
  if (!Number.isFinite(setSeconds) || setSeconds <= 0) return false;
  const speed = setup.speedMs > 0 ? setup.speedMs : Number.EPSILON;
  const residenceSeconds = (setup.nozzleLengthMm / 1000) / speed;
  return setSeconds <= residenceSeconds;
}

export function twoPartShoot(
  a: Experiment,
  bParts: Part[],
  ratio: TwoPartSetup,
  setup: ShotSetup,
): TwoPartReport {
  const aCheck = checkCartridge("A", a.parts, a.conditions);
  const bCheck = checkCartridge("B", bParts, a.conditions);
  if (aCheck.issue || bCheck.issue) {
    return {
      a: aCheck,
      b: bCheck,
      combined: null,
      clogsNozzle: false,
      shot: null,
      shotsPerCartridge: null,
      headline: aCheck.issue ? aCheck.message : bCheck.message,
    };
  }

  const experiment = combineAtTip(a, bParts, ratio);
  const result = simulate(experiment);
  const combined = { experiment, result };
  const clogsNozzle = clogsAtTip(result.setSeconds, setup);
  const predictedShot = shootTest(experiment, result, setup);
  const shot = clogsNozzle ? null : predictedShot;
  const volumeMl = predictedShot.jet?.volumeMl;
  const [shareA, shareB] = ratioShares(ratio);
  const shotsPerCartridge =
    volumeMl && volumeMl > 0 && shareA > 0 && shareB > 0
      ? Math.min(
          setup.cartridgeMl / (volumeMl * shareA),
          setup.cartridgeMl / (volumeMl * shareB),
        )
      : null;

  if (clogsNozzle) {
    return {
      a: aCheck,
      b: bCheck,
      combined,
      clogsNozzle,
      shot,
      shotsPerCartridge,
      headline: `Sets inside the nozzle (in ${fmtTime(result.setSeconds)}) and clogs the tip.`,
    };
  }

  const combinationHeadline =
    result.setSeconds > 0
      ? `A and B combine at the tip and set in ${fmtTime(result.setSeconds)}.`
      : "A and B combine at the tip; the combined mix doesn't set on its own.";
  return {
    a: aCheck,
    b: bCheck,
    combined,
    clogsNozzle,
    shot,
    shotsPerCartridge,
    headline: `${combinationHeadline} ${predictedShot.headline}`,
  };
}

export function parseStoredCartridgeB(raw: unknown): Part[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const parts: Part[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const part = entry as Partial<Part>;
    if (
      typeof part.id !== "string" ||
      !benchById[part.id] ||
      typeof part.pct !== "number" ||
      !Number.isFinite(part.pct) ||
      part.pct < 0 ||
      part.pct > 100 ||
      seen.has(part.id)
    ) {
      continue;
    }
    seen.add(part.id);
    parts.push({ id: part.id, pct: part.pct });
  }
  return parts;
}
