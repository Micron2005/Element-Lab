import { describe, expect, it } from "vitest";
import { benchPresets } from "./bench/presets";
import { simulate } from "./bench/simulate";
import { analyze } from "./formula";
import { PRESETS } from "./formula";
import { FUSION_RECIPES, PROJECTILES, fuse } from "./nuclearFusion";
import {
  benchReport,
  formulaReport,
  nucleusReport,
  pdfSafe,
  reportFileName,
} from "./labReport";
import { renderLabReportBytes } from "./labReportPdf";

describe("lab report documents", () => {
  it("builds an ordered Bench report from a real preset run", () => {
    const experiment = benchPresets.find((preset) => preset.id === "alginate-fiber")!.experiment;
    const result = simulate(experiment);
    const report = benchReport(experiment, result, {
      name: "Stretch",
      setup: [["Pull speed", "50 mm/min"]],
      headline: "It stretches.",
      metrics: [{ label: "Holds", value: "2 kg" }],
      notes: ["Rough estimate."],
    });
    expect(report.sections.map((section) => section.heading)).toEqual([
      "Materials", "Method", "Results", "What happened", "Test: Stretch",
      "Safety", "Model limits", "Notes",
    ]);
    expect(report.sections[0].table?.rows.map((row) => row[0])).toContain("Sodium alginate");
    expect(report.disclaimer).toContain("not a lab measurement");
  });

  it("omits Question when none is supplied and includes it when supplied", () => {
    const experiment = benchPresets[0].experiment;
    const result = simulate(experiment);
    expect(benchReport(experiment, result).sections.some(({ heading }) => heading === "Question")).toBe(false);
    expect(benchReport(experiment, result, undefined, { question: "Will it set?" }).sections[0]).toEqual({
      heading: "Question",
      paragraph: "Will it set?",
    });
  });

  it("labels hypothetical nuclei and uses measured half-lives", () => {
    expect(JSON.stringify(nucleusReport(120, 179))).toContain("not a discovered element");
    const tritium = nucleusReport(1, 2);
    expect(JSON.stringify(tritium)).toContain("12.3 years (measured)");
  });

  it("includes fusion output and displays no-product energy as an em dash", () => {
    const dt = FUSION_RECIPES.find((recipe) => recipe.id === "dt")!;
    const d = PROJECTILES.find((projectile) => projectile.id === dt.projectileId)!;
    const dtReport = fuse(d, dt.target, 0.107);
    const report = nucleusReport(dt.target.z, dt.target.n, {
      report: dtReport,
      projectileLabel: "Deuterium",
      beamLabMeV: 0.107,
    });
    expect(JSON.stringify(report.sections)).toContain("He-4");
    expect(JSON.stringify(report.sections)).toContain("17.59");

    const noProduct = fuse({ z: 20, n: 28 }, { z: 98, n: 151 }, 150);
    const empty = nucleusReport(98, 151, {
      report: noProduct,
      projectileLabel: "Calcium-48",
      beamLabMeV: 150,
    });
    expect(empty.sections.find(({ heading }) => heading === "Fusion")?.rows).toContainEqual([
      "Energy released",
      "—",
    ]);
  });

  it("builds a Formula Lab report from a real preset", () => {
    const parts = PRESETS[0].parts;
    const report = formulaReport(parts, analyze(parts), { question: "Can it stretch?" });
    expect(report.sections.map((section) => section.heading)).toEqual([
      "Question", "Materials", "Results", "Cure mechanisms", "Environment", "Checks", "Safety", "Notes",
    ]);
    expect(report.sections[1].table?.rows.map((row) => row[0])).toContain("Recombinant spider silk protein (MaSp)");
  });

  it("maps PDF text to WinAnsi-safe characters", () => {
    expect(pdfSafe("H₂O → 5 μm ≥ 3 ≈ 2 — 25 °C ✓ 日本")).toBe(
      "H2O -> 5 µm >= 3 ~ 2 — 25 °C OK ??",
    );
    expect(pdfSafe("Q β− and γ, −3")).toBe("Q beta- and gamma, -3");
  });

  it("creates a dated, slugged file name", () => {
    const report = nucleusReport(118, 176, undefined, { now: new Date("2025-04-03T12:00:00Z") });
    expect(reportFileName(report)).toBe(
      "science-lab-elements-nucleus-oganesson-294-2025-04-03.pdf",
    );
  });

  it("renders a valid multi-page PDF", async () => {
    const report = nucleusReport(1, 2, undefined, { now: new Date("2025-04-03T12:00:00Z") });
    report.sections.push({ heading: "Observations", bullets: Array.from({ length: 120 }, (_, i) => `Observation ${i + 1}: the sample changed under the test conditions.`) });
    const bytes = await renderLabReportBytes(report);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    const pdf = new TextDecoder().decode(bytes);
    expect((pdf.match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });

  it("preserves Spanish accents in generated PDF text", async () => {
    const report = nucleusReport(1, 2, undefined, {
      now: new Date("2025-04-03T12:00:00Z"),
      question: "¿Qué pasó? á é í ó ú ñ ¡",
    });
    report.locale = "es";
    const bytes = await renderLabReportBytes(report);
    const pdf = new TextDecoder("latin1").decode(bytes);
    for (const character of ["á", "é", "í", "ó", "ú", "ñ", "¿", "¡"]) {
      expect(pdf).toContain(character);
    }
  });
});
