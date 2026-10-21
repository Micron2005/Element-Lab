import { benchById } from "./library";
import type { Conditions, Experiment } from "./types";

export const DEFAULT_CONDITIONS: Conditions = {
  tempC: 25,
  pH: 7,
  pressureKPa: 101.3,
  atmosphere: "air",
  humidityPct: 50,
  mixRpm: 500,
  mixMinutes: 5,
  cureMinutes: 60,
  forming: "beaker",
};

export function waterBoilingPointC(pressureKPa: number): number {
  const safePressure = Math.max(pressureKPa, 0.0001);
  const pressureMmHg = safePressure * 7.50062;
  return 1730.63 / (8.07131 - Math.log10(pressureMmHg)) - 233.426;
}

export function effectivePH(experiment: Experiment): number {
  const shift = experiment.parts.reduce((total, part) => {
    const ingredient = benchById[part.id];
    return total + (ingredient?.pHShift ?? 0) * part.pct;
  }, 0);
  return Math.max(0, Math.min(14, experiment.conditions.pH + shift));
}

export function solventBoilingPointC(
  boilC: number,
  pressureKPa: number,
): number {
  const waterAtPressure = waterBoilingPointC(pressureKPa);
  const waterAtStandardPressure = waterBoilingPointC(101.3);
  return (
    boilC -
    ((waterAtStandardPressure - waterAtPressure) * (boilC + 273)) / 373
  );
}
