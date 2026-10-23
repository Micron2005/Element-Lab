import { benchById } from "./library";
import { jet } from "../physics";
import type { Experiment, RunResult } from "./types";

export const LAUNCH_HEIGHT_M = 1.5;

export interface ShotSetup {
  nozzleMm: number;
  speedMs: number;
  distanceM: number;
  nozzleLengthMm: number;
  cartridgeMl: number;
}

export const DEFAULT_SHOT: ShotSetup = {
  nozzleMm: 0.5,
  speedMs: 20,
  distanceM: 10,
  nozzleLengthMm: 5,
  cartridgeMl: 30,
};

export interface MixFluid {
  densityKgM3: number;
  viscosityPas: number | null;
  surfaceTensionNm: number;
  solidsFraction: number;
  setSeconds: number;
  notes: string[];
}

export type ShotVerdict =
  | "shoots"
  | "breaks-up"
  | "falls-short"
  | "too-thick"
  | "sets-in-cartridge"
  | "nothing-to-shoot"
  | "unsafe";

export interface ShotReport {
  fluid: MixFluid;
  jet: ReturnType<typeof jet> | null;
  verdict: ShotVerdict;
  headline: string;
  notes: string[];
  holdsKg: number | null;
}

export function formatBar(pressureBar: number): string {
  if (pressureBar >= 1e6) {
    return `${(pressureBar / 1e6).toPrecision(3)} million`;
  }
  return Math.round(pressureBar).toLocaleString("en-US");
}

interface KnownPart {
  weight: number;
  pct: number;
  ingredient: (typeof benchById)[string];
}

function knownParts(experiment: Experiment): KnownPart[] {
  const parts = experiment.parts.flatMap((part) => {
    const ingredient = benchById[part.id];
    if (!ingredient || !Number.isFinite(part.pct) || part.pct <= 0) return [];
    return [{ ingredient, pct: part.pct, weight: 0 }];
  });
  const total = parts.reduce((sum, part) => sum + part.pct, 0);
  if (total <= 0) return [];
  return parts.map((part) => ({
    ...part,
    weight: part.pct / total,
    pct: (part.pct / total) * 100,
  }));
}

export function fluidFromMix(experiment: Experiment, result: RunResult): MixFluid {
  const parts = knownParts(experiment);
  const notes: string[] = [];
  const inverseDensity = parts.reduce((sum, part) => {
    const density = part.ingredient.density > 0 ? part.ingredient.density : 1;
    return sum + part.weight / density;
  }, 0);
  const densityKgM3 = inverseDensity > 0 ? 1000 / inverseDensity : 1000;
  const liquids = parts.filter(
    (part) =>
      part.ingredient.viscosityPas !== undefined &&
      Number.isFinite(part.ingredient.viscosityPas) &&
      part.ingredient.viscosityPas > 0,
  );
  const liquidWeight = liquids.reduce((sum, part) => sum + part.weight, 0);
  const hasNonLiquidPolymerOrProtein = parts.some(
    (part) =>
      part.ingredient.viscosityPas === undefined &&
      (part.ingredient.category === "polymer" ||
        part.ingredient.category === "protein"),
  );

  let viscosityPas: number | null = null;
  if (liquidWeight > 0) {
    const logViscosity = liquids.reduce(
      (sum, part) =>
        sum + part.weight * Math.log(part.ingredient.viscosityPas as number),
      0,
    );
    viscosityPas = Math.exp(logViscosity / liquidWeight);
    const thickenerPct = parts.reduce(
      (sum, part) =>
        sum +
        (part.ingredient.viscosityPas === undefined &&
        (part.ingredient.category === "polymer" ||
          part.ingredient.category === "protein")
          ? part.pct
          : 0),
      0,
    );
    viscosityPas *= 10 ** (thickenerPct / 4);

    const { fraction: fillerFraction, massFraction: fillerMassFraction } =
      parts.reduce(
        (sum, part) => {
          if (
            part.ingredient.category !== "element" &&
            part.ingredient.category !== "filler"
          ) {
            return sum;
          }
          const density =
            part.ingredient.density > 0 ? part.ingredient.density : 1;
          return {
            fraction:
              sum.fraction +
              part.weight * (densityKgM3 / (density * 1000)),
            massFraction: sum.massFraction + part.weight,
          };
        },
        { fraction: 0, massFraction: 0 },
      );
    if (fillerFraction >= 0.6 || fillerMassFraction >= 0.6) {
      viscosityPas = null;
      notes.push("Too much solid filler to flow.");
    } else {
      viscosityPas *= (1 - fillerFraction / 0.64) ** -1.6;
    }
    if (viscosityPas !== null && result.product === "slime") {
      viscosityPas *= 100;
      notes.push("Borax-style crosslinks make this a thick putty.");
    }
    if (viscosityPas !== null) viscosityPas = Math.min(1e5, viscosityPas);
    if (
      viscosityPas !== null &&
      viscosityPas > 1 &&
      (hasNonLiquidPolymerOrProtein || result.product === "slime")
    ) {
      notes.push(
        "Real polymer mixes thin out when pushed through a nozzle, so this fixed-thickness estimate runs on the thick side.",
      );
    }
  } else {
    notes.push("No liquid in the mix.");
  }

  const surfaceTensionNm =
    liquidWeight > 0
      ? liquids.reduce(
          (sum, part) =>
            sum +
            part.weight * (part.ingredient.surfaceTensionNm ?? 0.072),
          0,
        ) / liquidWeight
      : 0.072;
  const hasProtein = parts.some(
    (part) => part.ingredient.category === "protein" && part.pct > 0.5,
  );
  const adjustedSurfaceTension = hasProtein
    ? Math.max(0.03, 0.75 * surfaceTensionNm)
    : surfaceTensionNm;
  if (hasProtein) notes.push("Proteins lower surface tension.");

  const volatileFraction = parts.reduce(
    (sum, part) => sum + (part.ingredient.volatile ? part.weight : 0),
    0,
  );

  return {
    densityKgM3,
    viscosityPas,
    surfaceTensionNm: adjustedSurfaceTension,
    solidsFraction: Math.max(0, Math.min(1, 1 - volatileFraction)),
    setSeconds: result.setSeconds,
    notes,
  };
}

function report(
  fluid: MixFluid,
  verdict: ShotVerdict,
  headline: string,
  notes: string[],
): ShotReport {
  return { fluid, jet: null, verdict, headline, notes, holdsKg: null };
}

export function shootTest(
  experiment: Experiment,
  result: RunResult,
  setup: ShotSetup,
): ShotReport {
  const fluid = fluidFromMix(experiment, result);
  const parts = knownParts(experiment);
  if (result.product === "dangerous") {
    return report(
      fluid,
      "unsafe",
      "Won't fire: this mix is hazardous.",
      result.warnings.filter((warning) => warning.level === "bad").map((warning) => warning.text),
    );
  }

  const hasLiquid = parts.some((part) => part.ingredient.viscosityPas !== undefined);
  const hasSolids = parts.some(
    (part) => part.ingredient.category !== "solvent",
  );
  if (parts.length === 0 || (!hasLiquid && !hasSolids)) {
    return report(fluid, "nothing-to-shoot", "Nothing to shoot from this mix.", fluid.notes);
  }
  if (fluid.viscosityPas === null) {
    return report(
      fluid,
      "too-thick",
      "Dry powder / too much filler: nothing to push through a nozzle.",
      fluid.notes,
    );
  }
  if (
    experiment.conditions.forming === "beaker" &&
    ["gel", "solid", "clumps"].includes(result.product) &&
    result.setSeconds > 0 &&
    result.setSeconds <= 30
  ) {
    return report(
      fluid,
      "sets-in-cartridge",
      `It sets in about ${result.setSeconds.toFixed(1)} s and would clog the cartridge.`,
      [
        ...fluid.notes,
        "Try Forming = extrude into air or a bath so it sets after leaving the nozzle.",
      ],
    );
  }

  const j = jet({
    ...setup,
    viscosityPas: fluid.viscosityPas,
    densityKgM3: fluid.densityKgM3,
    surfaceTensionNm: fluid.surfaceTensionNm,
    solidsFraction: fluid.solidsFraction,
    cureSeconds: fluid.setSeconds > 0 ? fluid.setSeconds : Infinity,
  });
  const notes = [...fluid.notes];
  if (j.pressureBar > 1000) {
    let low = 0;
    let high = setup.speedMs;
    const pressureAt = (speedMs: number) =>
      jet({
        ...setup,
        speedMs,
        viscosityPas: fluid.viscosityPas as number,
        densityKgM3: fluid.densityKgM3,
        surfaceTensionNm: fluid.surfaceTensionNm,
        solidsFraction: fluid.solidsFraction,
        cureSeconds: fluid.setSeconds > 0 ? fluid.setSeconds : Infinity,
      }).pressureBar;
    if (pressureAt(low) <= 1000) {
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const middle = (low + high) / 2;
        if (pressureAt(middle) <= 1000) low = middle;
        else high = middle;
      }
    }
    const speedNote =
      low >= 0.1
        ? `At this nozzle it can fire up to ${low.toFixed(1)} m/s.`
        : "No useful speed works with this nozzle.";
    return {
      fluid,
      jet: j,
      verdict: "too-thick",
      headline: `Won't fire: it would need about ${formatBar(j.pressureBar)} bar; this test caps pumps at 1,000 bar.`,
      notes: [
        ...notes,
        speedNote,
        "Try a wider or shorter nozzle, or thin the mix with more solvent.",
      ],
      holdsKg:
        result.tensileMPa > 0
          ? (result.tensileMPa *
              1e6 *
              Math.PI *
              (j.dryDiameterMm / 2000) ** 2) /
            9.81
          : null,
    };
  }

  const holdsKg =
    result.tensileMPa > 0
      ? (result.tensileMPa *
          1e6 *
          Math.PI *
          (j.dryDiameterMm / 2000) ** 2) /
        9.81
      : null;
  const fallsShort = j.dropM > LAUNCH_HEIGHT_M;
  const landingS = fallsShort
    ? Math.min(
        j.flightS,
        Math.sqrt((2 * LAUNCH_HEIGHT_M) / 9.81),
      )
    : j.flightS;
  if (fluid.setSeconds > 0 && fluid.setSeconds <= landingS) {
    notes.push("It sets before landing.");
  } else if (fluid.setSeconds === 0) {
    notes.push("It doesn't set on its own; it lands as a liquid.");
  } else if (fallsShort) {
    notes.push("It is still wet when it hits the ground.");
  } else {
    notes.push("It is still wet when it reaches the target.");
  }
  notes.push(
    j.pressureBar < 5
      ? "Pressure is in hand-pump range (<5 bar)."
      : j.pressureBar < 60
        ? "Pressure is in CO₂-cartridge range (<60 bar)."
        : "Pressure is beyond the simplified CO₂-cartridge range.",
  );
  notes.push(`Minimum speed for less than 10% sag: ${j.minSpeed.toFixed(1)} m/s.`);

  if (fallsShort) {
    const groundM = Math.min(
      setup.distanceM,
      setup.speedMs * Math.sqrt((2 * LAUNCH_HEIGHT_M) / 9.81),
    );
    return {
      fluid,
      jet: j,
      verdict: "falls-short",
      headline: `Falls short: it droops to the ground about ${groundM.toFixed(1)} m out, before the ${setup.distanceM} m target.`,
      notes,
      holdsKg,
    };
  }
  if (!j.staysIntact) {
    return {
      fluid,
      jet: j,
      verdict: "breaks-up",
      headline: `Sprays into droplets after about ${j.breakupM.toFixed(1)} m.`,
      notes,
      holdsKg,
    };
  }
  return {
    fluid,
    jet: j,
    verdict: "shoots",
    headline: "The modeled strand reaches the target intact.",
    notes,
    holdsKg,
  };
}
