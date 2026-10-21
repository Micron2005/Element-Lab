// Semi-empirical (liquid-drop) mass formula, coefficients in MeV (Krane).
const aV = 15.75, aS = 17.8, aC = 0.711, aA = 23.7, aP = 11.18;
const MAGIC = [2, 8, 20, 28, 50, 82, 126, 184];

export const SYMBOLS = (
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og"
).split(" ");

export const NAMES = (
  "Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium Aluminium Silicon Phosphorus Sulfur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium Chromium Manganese Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium Strontium Yttrium Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium Iodine Xenon Caesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium Europium Gadolinium Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutetium Hafnium Tantalum Tungsten Rhenium Osmium Iridium Platinum Gold Mercury Thallium Lead Bismuth Polonium Astatine Radon Francium Radium Actinium Thorium Protactinium Uranium Neptunium Plutonium Americium Curium Berkelium Californium Einsteinium Fermium Mendelevium Nobelium Lawrencium Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium Copernicium Nihonium Flerovium Moscovium Livermorium Tennessine Oganesson"
).split(" ");

const ROOTS = ["nil", "un", "bi", "tri", "quad", "pent", "hex", "sept", "oct", "enn"];

export function elementName(z: number) {
  if (z >= 1 && z <= 118) return { name: NAMES[z - 1], symbol: SYMBOLS[z - 1], known: true };
  const digits = String(z).split("").map(Number);
  let name = digits.map((d) => ROOTS[d]).join("") + "ium";
  name = name.replace("biium", "bium").replace("triium", "trium").replace("ennnil", "ennil");
  const symbol = digits.map((d) => ROOTS[d][0]).join("");
  return {
    name: name[0].toUpperCase() + name.slice(1),
    symbol: symbol[0].toUpperCase() + symbol.slice(1),
    known: false,
  };
}

export function bindingEnergy(z: number, n: number) {
  const a = z + n;
  if (z < 1 || n < 0 || a < 2) return 0;
  const pair = z % 2 === 0 && n % 2 === 0 ? aP : z % 2 === 1 && n % 2 === 1 ? -aP : 0;
  return (
    aV * a -
    aS * Math.cbrt(a * a) -
    (aC * z * (z - 1)) / Math.cbrt(a) -
    (aA * (a - 2 * z) ** 2) / a +
    pair / Math.sqrt(a)
  );
}

const MN = 939.565, MH = 938.783, ME = 0.511, B_HE4 = 28.296;

/** Most stable Z for a given mass number (beta-stability line). */
export function stableZ(a: number) {
  return a / (2 + 0.0155 * Math.cbrt(a * a));
}

export interface NucleusReport {
  z: number;
  n: number;
  a: number;
  name: string;
  symbol: string;
  known: boolean;
  bindingMeV: number;
  perNucleonMeV: number;
  stableN: number;
  qAlpha: number;
  qBetaMinus: number;
  qBetaPlus: number;
  sn: number;
  sp: number;
  fissility: number;
  magicZ: boolean;
  magicN: boolean;
  bound: boolean;
  modes: string[];
  verdict: string;
  halfLife: string;
}

function fmtSeconds(s: number) {
  if (!isFinite(s)) return "Stable (no decay predicted)";
  if (s < 1e-21) return "< 10^-21 s (falls apart instantly)";
  if (s < 1e-6) return `~${s.toExponential(0)} s`;
  if (s < 1) return `~${(s * 1000).toPrecision(2)} ms`;
  if (s < 3600) return `~${s.toPrecision(2)} s`;
  if (s < 86400 * 365) return `~${(s / 3600).toPrecision(2)} hours`;
  const y = s / (86400 * 365.25);
  return y > 1e9 ? `~${y.toExponential(1)} years` : `~${y.toPrecision(2)} years`;
}

export function analyzeNucleus(z: number, n: number): NucleusReport {
  const a = z + n;
  const B = bindingEnergy(z, n);
  const el = elementName(z);
  const qAlpha = z > 2 && n > 2 ? bindingEnergy(z - 2, n - 2) + B_HE4 - B : -99;
  // Q(beta-) = M(Z,N) - M(Z+1,N-1) using atomic masses.
  const qBetaMinus = n > 0 ? bindingEnergy(z + 1, n - 1) - B + (MN - MH) : -99;
  const qBetaPlus = z > 1 ? bindingEnergy(z - 1, n + 1) - B - (MN - MH) - 2 * ME : -99;
  const sn = n > 0 ? B - bindingEnergy(z, n - 1) : 0;
  const sp = z > 1 ? B - bindingEnergy(z - 1, n) : 0;
  const fissility = (z * z) / a / 50.9;
  const bound = sn > 0 && sp > 0 && B > 0;

  const modes: string[] = [];
  if (!bound) modes.push(sn <= 0 ? "Neutron drips off" : "Proton drips off");
  if (fissility >= 1) modes.push("Splits in two instantly (fission)");
  else if (fissility > 0.75) modes.push("Spontaneous fission");
  if (qAlpha > 0 && a > 100) modes.push(`Alpha decay (Q ≈ ${qAlpha.toFixed(1)} MeV)`);
  if (qBetaMinus > 0) modes.push("Beta-minus (neutron → proton)");
  if (qBetaPlus > 0) modes.push("Beta-plus / electron capture (proton → neutron)");

  let halfS = Infinity;
  if (!bound || fissility >= 1) halfS = 1e-22;
  else {
    if (qAlpha > 0 && a > 100) {
      // Viola-Seaborg systematics (Sobiczewski 1989 coefficients).
      const log10T = (1.66175 * z - 8.5166) / Math.sqrt(qAlpha) - 0.20228 * z - 33.9069;
      halfS = Math.min(halfS, 10 ** log10T);
    }
    const qb = Math.max(qBetaMinus, qBetaPlus);
    if (qb > 0) halfS = Math.min(halfS, 10 ** (4 - 2.5 * Math.log10(Math.max(qb, 0.05))));
    if (fissility > 0.75) {
      const shell = MAGIC.includes(n) || MAGIC.includes(z) || (z >= 112 && z <= 126 && n >= 178 && n <= 190);
      const fissionS = 10 ** (40 * (1 - fissility) - 7 + (shell ? 6 : 0));
      halfS = Math.min(halfS, fissionS);
    }
  }

  const sz = stableZ(a);
  const stableN = Math.round(a - sz);
  const nearIsland = z >= 112 && z <= 126 && n >= 176 && n <= 190;
  let verdict: string;
  if (!bound) verdict = "Can't exist: the nucleus isn't bound, a nucleon flies off immediately.";
  else if (fissility >= 1) verdict = "Can't exist: electric repulsion between protons beats the nuclear glue.";
  else if (!isFinite(halfS) || halfS > 3e16) verdict = "Stable or practically stable.";
  else if (halfS > 1) verdict = "Radioactive but would last long enough to study.";
  else if (halfS > 1e-6) verdict = "Super short-lived: it would be made one atom at a time in an accelerator.";
  else verdict = "Exists for a blink: gone before it can form chemistry.";
  if (nearIsland) verdict += " This is near the predicted 'island of stability' (Z≈114-126, N≈184), where extra shell stability could make it last much longer than this model says.";

  return {
    z,
    n,
    a,
    name: el.name,
    symbol: el.symbol,
    known: el.known,
    bindingMeV: B,
    perNucleonMeV: a ? B / a : 0,
    stableN,
    qAlpha,
    qBetaMinus,
    qBetaPlus,
    sn,
    sp,
    fissility,
    magicZ: MAGIC.includes(z),
    magicN: MAGIC.includes(n),
    bound,
    modes,
    verdict,
    halfLife: fmtSeconds(halfS),
  };
}
