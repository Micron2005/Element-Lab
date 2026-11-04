import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "./glossary";
import { GLOSSARY_ES } from "./i18n/data/es/glossary";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
}

describe("glossary", () => {
  it("defines complete plain-English entries", () => {
    for (const [id, entry] of Object.entries(GLOSSARY)) {
      expect(entry.term.trim(), id).not.toBe("");
      expect(entry.plain.trim(), id).not.toBe("");
      expect(entry.plain.length, id).toBeLessThanOrEqual(220);
    }
  });

  it("defines Spanish entries within the same length limit", () => {
    for (const [id, entry] of Object.entries(GLOSSARY_ES)) {
      expect(entry.term.trim(), id).not.toBe("");
      expect(entry.plain.trim(), id).not.toBe("");
      expect(entry.plain.length, id).toBeLessThanOrEqual(220);
    }
    expect(Object.keys(GLOSSARY_ES).sort()).toEqual(Object.keys(GLOSSARY).sort());
  });

  it("contains every Term id used by TSX source", () => {
    const ids = new Set(Object.keys(GLOSSARY));
    const usages = sourceFiles(join(process.cwd(), "src")).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return [...source.matchAll(/<Term\s+id="([^"]+)"/g)].map((match) => ({ id: match[1], path }));
    });
    expect(usages.length).toBeGreaterThan(0);
    for (const usage of usages) expect(ids.has(usage.id), `${usage.id} in ${usage.path}`).toBe(true);
  });
});
