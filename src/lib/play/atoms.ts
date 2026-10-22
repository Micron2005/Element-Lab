export type AtomSymbol = "H" | "C" | "N" | "O" | "F" | "Cl" | "S" | "P";

export interface AtomInfo {
  symbol: AtomSymbol;
  name: string;
  valence: number;
  color: string;
  textColor: string;
  radius: number;
  electronegativity: number;
}

export const ATOMS: Record<AtomSymbol, AtomInfo> = {
  H: {
    symbol: "H",
    name: "Hydrogen",
    valence: 1,
    color: "#f5f5f5",
    textColor: "#111827",
    radius: 16,
    electronegativity: 2.2,
  },
  C: {
    symbol: "C",
    name: "Carbon",
    valence: 4,
    color: "#3a3f47",
    textColor: "#f9fafb",
    radius: 23,
    electronegativity: 2.55,
  },
  N: {
    symbol: "N",
    name: "Nitrogen",
    valence: 3,
    color: "#3b6cf6",
    textColor: "#ffffff",
    radius: 21,
    electronegativity: 3.04,
  },
  O: {
    symbol: "O",
    name: "Oxygen",
    valence: 2,
    color: "#ef4444",
    textColor: "#ffffff",
    radius: 21,
    electronegativity: 3.44,
  },
  F: {
    symbol: "F",
    name: "Fluorine",
    valence: 1,
    color: "#7ddc5a",
    textColor: "#17220f",
    radius: 20,
    electronegativity: 3.98,
  },
  Cl: {
    symbol: "Cl",
    name: "Chlorine",
    valence: 1,
    color: "#22c55e",
    textColor: "#102218",
    radius: 23,
    electronegativity: 3.16,
  },
  S: {
    symbol: "S",
    name: "Sulfur",
    valence: 2,
    color: "#facc15",
    textColor: "#241f08",
    radius: 22,
    electronegativity: 2.58,
  },
  P: {
    symbol: "P",
    name: "Phosphorus",
    valence: 3,
    color: "#f97316",
    textColor: "#28130a",
    radius: 23,
    electronegativity: 2.19,
  },
};
