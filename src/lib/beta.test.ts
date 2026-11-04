import { describe, expect, it } from "vitest";
import { BETA_FEATURES, defaultBetaFeatureSettings, isBetaCookie, parseBetaFeatureSettings } from "./beta";
import { en, es } from "./i18n";

describe("beta features", () => {
  it("recognizes only the enabled beta cookie value", () => {
    expect(isBetaCookie("1")).toBe(true);
    expect(isBetaCookie(undefined)).toBe(false);
    expect(isBetaCookie("0")).toBe(false);
    expect(isBetaCookie("true")).toBe(false);
  });

  it("has unique registered features with translated title and description keys", () => {
    const ids = BETA_FEATURES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { titleKey, descKey } of BETA_FEATURES) {
      expect(en[titleKey].trim()).not.toBe("");
      expect(es[titleKey].trim()).not.toBe("");
      expect(en[descKey].trim()).not.toBe("");
      expect(es[descKey].trim()).not.toBe("");
    }
  });

  it("enables registered features by default and preserves stored toggles", () => {
    expect(defaultBetaFeatureSettings()).toEqual({ "report-problem": true });
    expect(parseBetaFeatureSettings('{"report-problem":false,"unknown":false}')).toEqual({
      "report-problem": false,
    });
    expect(parseBetaFeatureSettings("{")).toEqual({ "report-problem": true });
  });
});
