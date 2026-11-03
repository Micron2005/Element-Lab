import type { KnownMolecule, MoleculeId } from "../../../play/molecule";

export type MoleculeTextOverlay = Partial<
  Pick<KnownMolecule, "name" | "shape" | "uses" | "fact" | "angle" | "caution">
>;

export const MOLECULE_TEXT_ES: Record<MoleculeId, MoleculeTextOverlay> = {
  hydrogen: { name: "Hidrógeno" },
  oxygen: { name: "Oxígeno" },
  nitrogen: { name: "Nitrógeno" },
  water: { name: "Agua" },
  "carbon-dioxide": { name: "Dióxido de carbono" },
  methane: { name: "Metano" },
  ammonia: { name: "Amoníaco" },
  "hydrogen-chloride": { name: "Cloruro de hidrógeno" },
  "hydrogen-peroxide": { name: "Peróxido de hidrógeno" },
  "hydrogen-cyanide": { name: "Cianuro de hidrógeno" },
  ethane: { name: "Etano" },
  ethylene: { name: "Etileno" },
  acetylene: { name: "Acetileno" },
  methanol: { name: "Metanol" },
  ethanol: { name: "Etanol" },
  "dimethyl-ether": { name: "Éter dimetílico" },
  formaldehyde: { name: "Formaldehído" },
  "formic-acid": { name: "Ácido fórmico" },
  "acetic-acid": { name: "Ácido acético" },
  "hydrogen-sulfide": { name: "Sulfuro de hidrógeno" },
  phosphine: { name: "Fosfina" },
  "hydrogen-fluoride": { name: "Fluoruro de hidrógeno" },
  "carbon-tetrachloride": { name: "Tetracloruro de carbono" },
  chloroform: { name: "Cloroformo" },
};
