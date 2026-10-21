const G = 9.81;

export interface LoadInput {
  massKg: number;
  tensileMPa: number;
  strands: number;
  /** Extra force from swinging/catching a fall (2 = a swing roughly doubles the pull). */
  dynamicFactor: number;
  safetyFactor: number;
}

export function strandForLoad(i: LoadInput) {
  const forceN = i.massKg * G * i.dynamicFactor * i.safetyFactor;
  const perStrandN = forceN / Math.max(1, i.strands);
  const areaM2 = i.tensileMPa > 0 ? perStrandN / (i.tensileMPa * 1e6) : Infinity;
  const diameterMm = Math.sqrt((4 * areaM2) / Math.PI) * 1000;
  return { forceN, perStrandN, diameterMm };
}

export interface JetInput {
  nozzleMm: number;
  speedMs: number;
  distanceM: number;
  /** Fluid viscosity, Pa*s (water 0.001, honey ~10). */
  viscosityPas: number;
  densityKgM3: number;
  surfaceTensionNm: number;
  nozzleLengthMm: number;
  solidsFraction: number;
  cartridgeMl: number;
  cureSeconds: number;
}

export function jet(i: JetInput) {
  const d = i.nozzleMm / 1000;
  const r = d / 2;
  const area = Math.PI * r * r;
  const v = Math.max(0.01, i.speedMs);
  const flightS = i.distanceM / v;
  const dropM = 0.5 * G * flightS * flightS;
  const volumeMl = area * i.distanceM * 1e6;
  const shots = volumeMl > 0 ? i.cartridgeMl / volumeMl : 0;

  const we = (i.densityKgM3 * v * v * d) / i.surfaceTensionNm;
  const oh = i.viscosityPas / Math.sqrt(i.densityKgM3 * i.surfaceTensionNm * d);
  // Weber (1931) intact length for a viscous jet in still air.
  const breakupM = 12 * d * Math.sqrt(we) * (1 + 3 * oh);

  const L = i.nozzleLengthMm / 1000;
  const viscousPa = (8 * i.viscosityPas * L * v) / (r * r);
  const inertialPa = 0.5 * i.densityKgM3 * v * v;
  const pressureBar = (viscousPa + inertialPa) / 1e5;
  const flowMlS = area * v * 1e6;
  const recoilN = i.densityKgM3 * area * v * v;

  // Minimum speed so the strand sags no more than 10% of the distance.
  const minSpeed = Math.sqrt((G * i.distanceM) / (2 * 0.1));
  const dryDiameterMm = i.nozzleMm * Math.sqrt(Math.max(0.01, i.solidsFraction));

  return {
    flightS,
    dropM,
    volumeMl,
    shots,
    we,
    oh,
    breakupM,
    staysIntact: breakupM >= i.distanceM,
    pressureBar,
    flowMlS,
    recoilN,
    minSpeed,
    dryDiameterMm,
    curesInFlight: i.cureSeconds <= flightS,
  };
}
