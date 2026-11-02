import { describe, expect, it } from "vitest";
import {
  bestBinding,
  beamForBarrier,
  fmtCrossSection,
  fmtOneIn,
  fuse,
  FUSION_RECIPES,
  measuredHalfLife,
  PROJECTILES,
} from "./nuclearFusion";

function projectile(id: string) {
  const found = PROJECTILES.find((item) => item.id === id);
  if (!found) throw new Error(`Missing projectile ${id}`);
  return found;
}

function recipeRun(id: string) {
  const recipe = FUSION_RECIPES.find((item) => item.id === id);
  if (!recipe) throw new Error(`Missing recipe ${id}`);
  const shot = projectile(recipe.projectileId);
  const beamLabMeV =
    "labMeV" in recipe.beam
      ? recipe.beam.labMeV
      : beamForBarrier(shot, recipe.target, recipe.beam.barrierFactor);
  return { recipe, shot, beamLabMeV, report: fuse(shot, recipe.target, beamLabMeV) };
}

describe("nuclear fusion model", () => {
  it("uses measured bindings for light nuclei and falls back to the liquid-drop model", () => {
    expect(bestBinding(2, 2)).toBe(28.295673);
    expect(bestBinding(0, 1)).toBe(0);
    expect(bestBinding(1, 0)).toBe(0);
    expect(bestBinding(12, 14)).toBeGreaterThan(0);
  });

  it("reports the D-T fusion recipe", () => {
    const { report } = recipeRun("dt");
    expect(report.residue.map(({ z, n }) => [z, n])).toEqual([[2, 2]]);
    expect(report.emitted).toContainEqual({ type: "n", count: 1 });
    expect(report.energyReleasedMeV).toBeCloseTo(17.59, 2);
    expect(report.light).toBe(true);
    expect(report.chancePerCollision).toBeGreaterThan(0.01);
    expect(report.chancePerCollision).toBeLessThan(0.5);
    expect(report.dominant).toBe("bounce");
    expect(report.steps.map((step) => step.kind)).toEqual([
      "bounce",
      "fusion",
      "evaporation",
    ]);
  });

  it("models Cockcroft and Walton's two-alpha reaction", () => {
    const { report } = recipeRun("pli");
    expect(report.residue.map(({ z, n }) => [z, n])).toEqual([
      [2, 2],
      [2, 2],
    ]);
    expect(report.energyReleasedMeV).toBeCloseTo(17.35, 2);
  });

  it("follows the easier D-D branch to tritium and a proton", () => {
    const { report } = recipeRun("dd");
    expect(report.residue.map(({ z, n }) => [z, n])).toEqual([[1, 2]]);
    expect(measuredHalfLife(1, 2)).toBe("12.3 years");
    expect(report.steps.at(-1)?.halfLife).toBe("12.3 years");
    expect(report.emitted).toContainEqual({ type: "p", count: 1 });
    expect(report.energyReleasedMeV).toBeCloseTo(4.03, 2);
    expect(report.notes.join(" ")).not.toContain("falls apart instantly");
  });

  it("uses the measured stable half-life for helium-4", () => {
    const { report } = recipeRun("dt");
    expect(measuredHalfLife(2, 2)).toBe("stable");
    expect(report.steps.at(-1)?.halfLife).toBe("stable");
  });

  it("predicts the Oganesson recipe within the specified heavy-ion bounds", () => {
    const { beamLabMeV, report } = recipeRun("oganesson");
    expect(report.barrierMeV).toBeGreaterThan(195);
    expect(report.barrierMeV).toBeLessThan(212);
    expect(beamLabMeV).toBeGreaterThan(245);
    expect(beamLabMeV).toBeLessThan(265);
    expect(report.reaction).toContain("Og-297*");
    expect(report.emitted.find(({ type }) => type === "n")?.count).toBeGreaterThanOrEqual(3);
    expect(report.emitted.find(({ type }) => type === "n")?.count).toBeLessThanOrEqual(5);
    expect(report.dominant).toBe("quasi-fission");
    expect(report.crossSectionBarn).toBeGreaterThan(1e-15);
    expect(report.crossSectionBarn).toBeLessThan(1e-9);
    expect(report.residue[0].z).toBe(118);
  });

  it("reports a sub-barrier Ca-48 + Cf-249 shot as a negligible bounce", () => {
    const report = fuse(projectile("ca48"), { z: 98, n: 151 }, 150);
    expect(report.dominant).toBe("bounce");
    expect(report.crossSectionBarn).toBeLessThan(1e-20);
  });

  it("makes very low-energy D-T collisions overwhelmingly bounce", () => {
    const report = fuse(projectile("d"), { z: 1, n: 2 }, 0.001);
    expect(report.dominant).toBe("bounce");
    expect(report.chancePerCollision).toBeLessThan(1e-4);
  });

  it("does not provide a success path for a supercritical compound nucleus", () => {
    const report = fuse(projectile("zn70"), { z: 170, n: 300 }, 1000);
    expect(report.successPossible).toBe(false);
    expect(report.dominant).toBe("fusion-fission");
  });

  it("labels element 120 as a prediction", () => {
    const { report } = recipeRun("e120");
    expect(report.residue[0].z).toBe(120);
    expect(report.notes.join(" ")).toContain("prediction, not a discovery");
  });

  it("solves the lab beam energy needed for a chosen barrier factor", () => {
    const shot = projectile("ca48");
    const target = { z: 98, n: 151 };
    const beamLabMeV = beamForBarrier(shot, target, 1.03);
    const report = fuse(shot, target, beamLabMeV);
    expect(report.ecmMeV / report.barrierMeV).toBeCloseTo(1.03, 10);
  });

  it("formats cross sections across the supported units", () => {
    expect(fmtCrossSection(2.4)).toBe("2.4 b");
    expect(fmtCrossSection(1e-3)).toBe("1 mb");
    expect(fmtCrossSection(1e-6)).toBe("1 µb");
    expect(fmtCrossSection(1e-9)).toBe("1 nb");
    expect(fmtCrossSection(1e-12)).toBe("1 pb");
    expect(fmtCrossSection(1e-15)).toBe("1 fb");
    expect(fmtCrossSection(0.99e-15)).toBe("< 1 fb");
    expect(fmtCrossSection(0)).toBe("< 1 fb");
  });

  it("formats one-in odds and handles edge probabilities", () => {
    expect(fmtOneIn(1 / 3)).toBe("1 in 3");
    expect(fmtOneIn(1 / 2400)).toBe("1 in 2,400");
    expect(fmtOneIn(1e-12)).toBe("1 in 10^12");
    expect(fmtOneIn(0.5)).toBe("most hits");
    expect(fmtOneIn(0)).toBe("never");
    expect(fmtOneIn(-0.1)).toBe("never");
  });
});
