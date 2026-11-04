import { describe, expect, it } from "vitest";
import { hazardWord, waterLabel } from "../formula";
import { localizeIngredientFormula } from "../ingredients";
import { tr } from "../i18n";
import {
  DISSOLVE_LIQUID_LABEL_KEYS,
  DROP_FLOOR_LABEL_KEYS,
  STICK_SURFACE_LABEL_KEYS,
} from "./materialTests";
import { CUSTOM_PREFIX } from "./custom";
import { benchIngredientFormulaLabel } from "./library";
import {
  benchBooleanLabel,
  BENCH_BOOLEAN_LABEL_KEYS,
  BENCH_CONFIDENCE_LABEL_KEYS,
  BENCH_EVENT_STATUS_LABEL_KEYS,
  BENCH_FILTER_LABEL_KEYS,
  BENCH_FILTER_OPTIONS,
  BENCH_HEAT_ATMOSPHERE_LABEL_KEYS,
  BENCH_PRODUCT_LABEL_KEYS,
  BENCH_REACTION_STATUS_LABEL_KEYS,
  BENCH_SCENE_PHASE_LABEL_KEYS,
  BENCH_TEST_STATUS_LABEL_KEYS,
  BENCH_VIEWER_TEST_LABEL_KEYS,
  BENCH_WATER_LABEL_KEYS,
  CATEGORY_LABEL_KEYS,
  CUSTOM_CATEGORY_LABEL_KEYS,
  CUSTOM_HAZARD_LABEL_KEYS,
  CUSTOM_WATER_LABEL_KEYS,
  REPORT_BOOLEAN_LABEL_KEYS,
  benchCategoryLabel,
  benchConfidenceLine,
  benchConfidenceLabel,
  benchScenePhaseBadgeLabel,
} from "./displayLabels";
import type { Category, Hazard, WaterBehavior } from "./types";

const IDENTICAL_LABEL_ALLOWLIST = new Set([
  "assistant.state.no",
  "bench.no",
  "report.biodegradable",
  "report.no",
  "bench.product.slime",
  "bench.product.gel",
]);

function expectSpanish(en: string, es: string) {
  expect(es).not.toBe("");
  expect(es).not.toBe(en);
}

function expectMessageLocalized(key: Parameters<typeof tr>[1]) {
  const english = tr("en", key);
  const spanish = tr("es", key);
  if (IDENTICAL_LABEL_ALLOWLIST.has(key)) {
    expect(spanish).toBe(english);
  } else {
    expectSpanish(english, spanish);
  }
}

describe("Bench display enum labels", () => {
  it("localizes every category label used by the Bench and reports", () => {
    for (const category of Object.keys(CATEGORY_LABEL_KEYS) as Category[]) {
      expectSpanish(
        benchCategoryLabel(category, "en"),
        benchCategoryLabel(category, "es"),
      );
      expectSpanish(
        tr("en", CUSTOM_CATEGORY_LABEL_KEYS[category]),
        tr("es", CUSTOM_CATEGORY_LABEL_KEYS[category]),
      );
    }
    for (const filter of BENCH_FILTER_OPTIONS) {
      expectSpanish(
        tr("en", BENCH_FILTER_LABEL_KEYS[filter]),
        tr("es", BENCH_FILTER_LABEL_KEYS[filter]),
      );
    }
  });

  it("localizes every hazard and water-behavior label", () => {
    for (const hazard of [0, 1, 2, 3] as Hazard[]) {
      expectSpanish(hazardWord(hazard, "en"), hazardWord(hazard, "es"));
      expectSpanish(
        tr("en", CUSTOM_HAZARD_LABEL_KEYS[hazard]),
        tr("es", CUSTOM_HAZARD_LABEL_KEYS[hazard]),
      );
    }
    for (const water of ["dissolves", "swells", "resists"] as WaterBehavior[]) {
      expectSpanish(waterLabel(water, "en"), waterLabel(water, "es"));
      expectSpanish(
        tr("en", CUSTOM_WATER_LABEL_KEYS[water]),
        tr("es", CUSTOM_WATER_LABEL_KEYS[water]),
      );
    }
  });

  it("localizes confidence, boolean and mixing-stage labels", () => {
    for (const key of Object.values(BENCH_CONFIDENCE_LABEL_KEYS)) {
      expectSpanish(tr("en", key), tr("es", key));
    }
    for (const confidence of [0.9, 0.6, 0.2]) {
      expectSpanish(
        benchConfidenceLabel(confidence, "en"),
        benchConfidenceLabel(confidence, "es"),
      );
    }
    expect(benchConfidenceLine(0.9, 100, "es")).toBe("Alta confianza · 100%");
    expectSpanish(
      benchConfidenceLine(0.9, 100, "en"),
      benchConfidenceLine(0.9, 100, "es"),
    );
    for (const labels of [BENCH_BOOLEAN_LABEL_KEYS, REPORT_BOOLEAN_LABEL_KEYS]) {
      for (const key of Object.values(labels)) {
        expectMessageLocalized(key);
      }
    }
    expectSpanish(benchBooleanLabel(true, "en"), benchBooleanLabel(true, "es"));
    expect(benchBooleanLabel(false, "en")).toBe(tr("en", BENCH_BOOLEAN_LABEL_KEYS.no));
    expect(benchBooleanLabel(false, "es")).toBe(tr("es", BENCH_BOOLEAN_LABEL_KEYS.no));
    for (const key of [
      "report.confidence",
      "report.biodegradable",
      "lab.ui.notBiodegradable",
      "assistant.state.yes",
      "assistant.state.no",
    ] as const) {
      expectMessageLocalized(key);
    }
    for (const [id, key] of Object.entries(BENCH_SCENE_PHASE_LABEL_KEYS)) {
      expectSpanish(tr("en", key), tr("es", key));
      expectSpanish(
        benchScenePhaseBadgeLabel(id as keyof typeof BENCH_SCENE_PHASE_LABEL_KEYS, "en"),
        benchScenePhaseBadgeLabel(id as keyof typeof BENCH_SCENE_PHASE_LABEL_KEYS, "es"),
      );
    }
  });

  it("localizes built-in formula connectors but preserves custom ingredient text", () => {
    const formula = "C2H4O2 in H2O";
    expect(benchIngredientFormulaLabel({ id: "acetic-acid", formula }, "es")).toBe("C2H4O2 en H2O");
    expect(
      benchIngredientFormulaLabel({ id: `${CUSTOM_PREFIX}student`, formula }, "es"),
    ).toBe(formula);
  });

  it("covers typed maps used by dynamically selected Bench labels", () => {
    const maps = [
      BENCH_EVENT_STATUS_LABEL_KEYS,
      BENCH_HEAT_ATMOSPHERE_LABEL_KEYS,
      BENCH_PRODUCT_LABEL_KEYS,
      BENCH_REACTION_STATUS_LABEL_KEYS,
      BENCH_TEST_STATUS_LABEL_KEYS,
      BENCH_VIEWER_TEST_LABEL_KEYS,
      BENCH_WATER_LABEL_KEYS,
      DISSOLVE_LIQUID_LABEL_KEYS,
      DROP_FLOOR_LABEL_KEYS,
      STICK_SURFACE_LABEL_KEYS,
    ];
    for (const labels of maps) {
      for (const key of Object.values(labels)) expectMessageLocalized(key);
    }
  });

  it("localizes Bench formula prose without changing chemical formulas", () => {
    const formulas = [
      "Protein (Gly/Ala-rich repeats)",
      "Protein (Gly-Ala-Gly-Ala-Gly-Ser repeats)",
      "Protein (collagen-derived)",
      "-[NH-CO-O]- urethane links",
      "(C5H8)n cis-polyisoprene",
      "C (oxidized sheets)",
      "Protein (collagen triple helix)",
      "Milk phosphoprotein",
      "Milk protein mixture",
      "Plant protein mixture",
      "Polysaccharide",
      "Corn prolamin protein",
      "Structural protein",
      "Repeating elastin-like peptide",
      "Catechol-rich adhesive protein",
      "Enzyme",
      "Enzyme (protease)",
    ];
    for (const formula of formulas) {
      expectSpanish(formula, localizeIngredientFormula(formula, "es"));
    }
    expect(localizeIngredientFormula("(C5H8)n cis-polyisoprene", "es")).toContain("(C5H8)n");
    expect(localizeIngredientFormula("C2H4O2 in H2O", "es")).toBe("C2H4O2 en H2O");
  });
});
