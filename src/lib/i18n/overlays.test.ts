import { describe, expect, it } from "vitest";
import { KNOWN_MOLECULES } from "../play/molecule";
import { MOLECULE_TEXT_ES } from "./data/es/molecule";

const placeholders = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
  .map((match) => match[1])
  .sort();

describe("Spanish data overlays", () => {
  it("covers every molecule id and keeps overlaid text complete", () => {
    const source = new Map(KNOWN_MOLECULES.map((molecule) => [molecule.id, molecule]));
    expect(Object.keys(MOLECULE_TEXT_ES).sort()).toEqual([...source.keys()].sort());

    for (const [id, overlay] of Object.entries(MOLECULE_TEXT_ES)) {
      const molecule = source.get(id as keyof typeof MOLECULE_TEXT_ES);
      expect(molecule).toBeDefined();
      for (const [field, translated] of Object.entries(overlay)) {
        expect(translated?.trim()).toBeTruthy();
        const original = molecule?.[field as keyof typeof molecule];
        if (typeof original === "string" && typeof translated === "string") {
          expect(translated).not.toBe(original);
          expect(placeholders(translated)).toEqual(placeholders(original));
        }
      }
    }
  });
});
