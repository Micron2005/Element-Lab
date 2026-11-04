import { benchById } from "./library";
import { jet } from "../physics";
import type { Experiment, RunResult } from "./types";
import { DEFAULT_LOCALE, tr, type Locale } from "../i18n";

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

export function formatBar(pressureBar: number, locale: Locale = DEFAULT_LOCALE): string {
  if (pressureBar >= 1e6) {
    return `${(pressureBar / 1e6).toPrecision(3)} ${tr(locale, "bench.model.shoot.million")}`;
  }
  return Math.round(pressureBar).toLocaleString(locale === "es" ? "es" : "en-US");
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

export function fluidFromMix(
  experiment: Experiment,
  result: RunResult,
  locale: Locale = DEFAULT_LOCALE,
): MixFluid {
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
      notes.push(tr(locale, "bench.model.shoot.tooMuchFiller"));
    } else {
      viscosityPas *= (1 - fillerFraction / 0.64) ** -1.6;
    }
    if (viscosityPas !== null && result.product === "slime") {
      viscosityPas *= 100;
      notes.push(tr(locale, "bench.model.shoot.boraxPutty"));
    }
    if (viscosityPas !== null) viscosityPas = Math.min(1e5, viscosityPas);
    if (
      viscosityPas !== null &&
      viscosityPas > 1 &&
      (hasNonLiquidPolymerOrProtein || result.product === "slime")
    ) {
      notes.push(
        tr(locale, "bench.model.shoot.estimate"),
      );
    }
  } else {
    notes.push(tr(locale, "bench.model.shoot.noLiquid"));
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
  if (hasProtein) notes.push(tr(locale, "bench.model.shoot.proteinSurface"));

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

function shootTestCore(
  experiment: Experiment,
  result: RunResult,
  setup: ShotSetup,
  locale: Locale,
): ShotReport {
  const fluid = fluidFromMix(experiment, result, locale);
  const parts = knownParts(experiment);
  if (result.product === "dangerous") {
    return report(
      fluid,
      "unsafe",
      tr(locale, "bench.model.shoot.unsafe"),
      result.warnings.filter((warning) => warning.level === "bad").map((warning) => warning.text),
    );
  }

  const hasLiquid = parts.some((part) => part.ingredient.viscosityPas !== undefined);
  const hasSolids = parts.some(
    (part) => part.ingredient.category !== "solvent",
  );
  if (parts.length === 0 || (!hasLiquid && !hasSolids)) {
    return report(fluid, "nothing-to-shoot", tr(locale, "bench.model.shoot.nothing"), fluid.notes);
  }
  if (fluid.viscosityPas === null) {
    return report(
      fluid,
      "too-thick",
      tr(locale, "bench.model.shoot.dry"),
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
      tr(locale, "bench.model.shoot.setsCartridge", { seconds: result.setSeconds.toFixed(1) }),
      [
        ...fluid.notes,
        tr(locale, "bench.model.shoot.formingHint"),
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
        ? tr(locale, "bench.model.shoot.maxSpeed", { speed: low.toFixed(1) })
        : tr(locale, "bench.model.shoot.noSpeed");
    return {
      fluid,
      jet: j,
      verdict: "too-thick",
      headline: tr(locale, "bench.model.shoot.pressureCap", { pressure: formatBar(j.pressureBar, locale) }),
      notes: [
        ...notes,
        speedNote,
        tr(locale, "bench.model.shoot.nozzleHint"),
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
    notes.push(tr(locale, "bench.model.shoot.setsBefore"));
  } else if (fluid.setSeconds === 0) {
    notes.push(tr(locale, "bench.model.shoot.liquidLanding"));
  } else if (fallsShort) {
    notes.push(tr(locale, "bench.model.shoot.wetGround"));
  } else {
    notes.push(tr(locale, "bench.model.shoot.wetTarget"));
  }
  notes.push(
    j.pressureBar < 5
      ? tr(locale, "bench.model.shoot.handPump")
      : j.pressureBar < 60
        ? tr(locale, "bench.model.shoot.cartridgeRange")
        : tr(locale, "bench.model.shoot.cartridgeBeyond"),
  );
  notes.push(tr(locale, "bench.model.shoot.minimumSpeed", { speed: j.minSpeed.toFixed(1) }));

  if (fallsShort) {
    const groundM = Math.min(
      setup.distanceM,
      setup.speedMs * Math.sqrt((2 * LAUNCH_HEIGHT_M) / 9.81),
    );
    return {
      fluid,
      jet: j,
      verdict: "falls-short",
      headline: tr(locale, "bench.model.shoot.fallsShort", {
        ground: groundM.toFixed(1), target: setup.distanceM,
      }),
      notes,
      holdsKg,
    };
  }
  if (!j.staysIntact) {
    return {
      fluid,
      jet: j,
      verdict: "breaks-up",
      headline: tr(locale, "bench.model.shoot.breakup", { distance: j.breakupM.toFixed(1) }),
      notes,
      holdsKg,
    };
  }
  return {
    fluid,
    jet: j,
    verdict: "shoots",
    headline: tr(locale, "bench.model.shoot.reachesTarget"),
    notes,
    holdsKg,
  };
}

export function shootTest(
  experiment: Experiment,
  result: RunResult,
  setup: ShotSetup,
  locale: Locale = DEFAULT_LOCALE,
): ShotReport {
  return shootTestCore(experiment, result, setup, locale);
}
