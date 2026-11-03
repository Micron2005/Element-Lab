import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, parsePrefs, PREFS_KEY, PREFS_SCRIPT } from "./prefs";

describe("display preferences", () => {
  it("uses defaults for missing and invalid input", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("null")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("[]")).toEqual(DEFAULT_PREFS);
  });

  it("defaults each invalid or missing field independently", () => {
    expect(parsePrefs('{"beginner":true,"contrast":"yes","motion":"fast"}')).toEqual({
      beginner: true,
      contrast: false,
      motion: "system",
    });
    expect(parsePrefs('{"contrast":true,"motion":"reduce"}')).toEqual({
      beginner: false,
      contrast: true,
      motion: "reduce",
    });
  });

  it("reads the persisted preference key before paint", () => {
    expect(PREFS_KEY).toBe("elementlab.prefs");
    expect(PREFS_SCRIPT).toContain("localStorage.getItem");
    expect(PREFS_SCRIPT).toContain('d.contrast=p.contrast===true?"1":"0"');
    expect(PREFS_SCRIPT).toContain("catch(e)");
  });
});
