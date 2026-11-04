import { describe, expect, it } from "vitest";
import { renderCertificateBytes } from "./certificate";

function extractPdfText(bytes: Uint8Array): string {
  const source = new TextDecoder("latin1").decode(bytes);
  const strings = [...source.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((match) =>
    match[1].replace(/\\([\\()])/g, "$1"),
  );
  return strings.join(" ");
}

describe("achievement certificate PDF", () => {
  it("embeds the student, achievement, date, brand, and Spanish accents in extractable text", async () => {
    const bytes = await renderCertificateBytes({
      studentName: "Ana Pérez",
      achievement: "Rango: Científica · ¿Qué aprendiste? ¡Excelente!",
      date: new Date("2025-04-03T12:00:00Z"),
      locale: "es",
    });
    const extracted = extractPdfText(bytes);
    expect(extracted).toContain("Science Lab");
    expect(extracted).toContain("Ana Pérez");
    expect(extracted).toContain("Científica");
    expect(extracted).toContain("3 de abril de 2025");
    expect(extracted).toContain("¿");
    expect(extracted).toContain("¡");
  });
});
