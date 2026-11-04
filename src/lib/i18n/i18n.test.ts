import { describe, expect, it } from "vitest";
import { en, es, pickLocale, tr, type MessageKey } from "./index";

const placeholders = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();

describe("i18n", () => {
  it("has non-empty Spanish values with matching placeholders", () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(es[key].trim(), key).not.toBe("");
      expect(es[key].length, key).toBeLessThanOrEqual(220);
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("picks a locale from cookie and quality-sorted Accept-Language", () => {
    expect(pickLocale("es", "en")).toBe("es");
    expect(pickLocale("bad", "es-MX,es;q=0.9")).toBe("es");
    expect(pickLocale(undefined, "fr,en;q=0.5")).toBe("en");
    expect(pickLocale(undefined, null)).toBe("en");
    expect(pickLocale(undefined, "en;q=0.3, es-MX;q=0.9")).toBe("es");
  });

  it("interpolates values and falls back to English when a translation is missing", () => {
    expect(tr("es", "glossary.example", { example: "agua" })).toBe("Ejemplo: agua");
    const key = "meta.home" as MessageKey;
    const original = es[key];
    delete (es as Partial<Record<MessageKey, string>>)[key];
    expect(tr("es", key)).toBe(en[key]);
    es[key] = original;
  });
});
