import { benchById } from "./library";
import type { Conditions, Experiment } from "./types";

export const DEFAULT_CONDITIONS: Conditions = {
  tempC: 25,
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
  const species = experiment.parts.flatMap((part) => {
    const acidBase = benchById[part.id]?.acidBase;
    if (!acidBase || !Number.isFinite(part.pct) || part.pct <= 0) return [];
    const formulaUnits = acidBase.molPerPct * part.pct;
    return [{
      acidBase,
      concentration: formulaUnits * (acidBase.sites ?? 1),
      cations: formulaUnits * (acidBase.cations ?? 0),
    }];
  });
  if (species.length === 0) return 7;

  const cations = species.reduce((total, item) => total + item.cations, 0);
  const chargeBalance = (ph: number) => {
    const hydrogen = 10 ** -ph;
    const speciesCharge = species.reduce((total, item) => {
      const { pKas, chargeProtonated = 0 } = item.acidBase;
      const terms: number[] = [];
      let kaProduct = 1;
      for (let deprotonated = 0; deprotonated <= pKas.length; deprotonated += 1) {
        if (deprotonated > 0) {
          kaProduct *= 10 ** -pKas[deprotonated - 1];
        }
        terms.push(hydrogen ** (pKas.length - deprotonated) * kaProduct);
      }
      const partition = terms.reduce((sum, term) => sum + term, 0);
      const averageCharge = terms.reduce(
        (sum, term, index) => sum + (term / partition) * (chargeProtonated - index),
        0,
      );
      return total + item.concentration * averageCharge;
    }, 0);
    return hydrogen + cations + speciesCharge - 1e-14 / hydrogen;
  };

  let low = -2;
  let high = 16;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const midpoint = (low + high) / 2;
    if (chargeBalance(midpoint) > 0) low = midpoint;
    else high = midpoint;
  }
  return Math.max(0, Math.min(14, (low + high) / 2));
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
