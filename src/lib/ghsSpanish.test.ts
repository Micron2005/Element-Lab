import { describe, expect, it } from "vitest";
import {
  GHS_HAZARD_STATEMENTS_ES,
  GHS_PICTOGRAMS_ES,
  GHS_SIGNAL_WORDS_ES,
  localizeGhsClassificationNote,
  localizeGhsHazardStatement,
  localizeGhsPictogram,
  localizeGhsSignalWord,
} from "./ghsSpanish";

const EXPECTED_CODES = [
  "H200", "H201", "H202", "H203", "H204", "H205", "H206", "H207", "H208",
  "H209", "H210", "H211", "H220", "H221", "H222", "H223", "H224", "H225", "H226", "H227", "H228", "H229", "H230", "H231", "H232",
  "H240", "H241", "H242", "H250", "H251", "H252", "H260", "H261", "H270", "H271", "H272", "H280", "H281", "H290",
  "H300", "H301", "H302", "H303", "H304", "H305", "H310", "H311", "H312", "H313", "H314", "H315", "H316", "H317", "H318", "H319", "H320",
  "H330", "H331", "H332", "H333", "H334", "H335", "H336", "H340", "H341", "H350", "H351", "H360", "H361", "H362", "H370", "H371", "H372", "H373",
  "H400", "H401", "H402", "H410", "H411", "H412", "H413", "H420",
];

describe("PubChem GHS Spanish display mappings", () => {
  it("covers every supported UN hazard statement code", () => {
    expect(Object.keys(GHS_HAZARD_STATEMENTS_ES).sort()).toEqual([...EXPECTED_CODES].sort());
    for (const phrase of Object.values(GHS_HAZARD_STATEMENTS_ES)) {
      expect(phrase.trim()).not.toBe("");
    }
  });

  it("localizes known phrases while preserving codes and unknown PubChem text", () => {
    expect(localizeGhsHazardStatement("H225: Highly Flammable liquid and vapor", "es"))
      .toBe("H225: Líquido y vapores muy inflamables.");
    expect(localizeGhsHazardStatement("H225 (> 99.9%): Highly Flammable", "es"))
      .toBe("H225 (> 99.9%): Líquido y vapores muy inflamables.");
    expect(localizeGhsHazardStatement("H999: PubChem text", "es")).toBe("H999: PubChem text");
    expect(localizeGhsHazardStatement("H225: English text", "en")).toBe("H225: English text");
    expect(localizeGhsHazardStatement("Not Classified", "es")).toBe("No clasificado");
  });

  it("localizes signal words, pictograms, and company-count notes", () => {
    expect(GHS_SIGNAL_WORDS_ES).toMatchObject({ danger: "Peligro", warning: "Atención" });
    expect(GHS_PICTOGRAMS_ES.flame).toBe("Inflamable");
    expect(GHS_PICTOGRAMS_ES.irritant).toBe("Irritante");
    expect(GHS_PICTOGRAMS_ES["health hazard"]).toBe("Peligro para la salud");
    expect(localizeGhsSignalWord("Not Classified", "es")).toBe("No clasificado");
    expect(localizeGhsPictogram("Unknown pictogram", "es")).toBe("Unknown pictogram");
    expect(localizeGhsPictogram("Health Hazard", "es")).toBe("Peligro para la salud");
    expect(localizeGhsPictogram("Health hazard", "es")).toBe("Peligro para la salud");
    expect(localizeGhsPictogram("GHS08", "es")).toBe("Peligro para la salud");
    expect(localizeGhsClassificationNote(
      "This chemical does not meet GHS hazard criteria for < 0.1% (5 of 13886) of reports.",
      "es",
    )).toContain("5 de 13886");
    expect(localizeGhsClassificationNote(
      "Reported as not meeting GHS hazard criteria by 5 of 10 companies.",
      "es",
    )).toContain("5 de 10");
    expect(localizeGhsClassificationNote(
      "Reported as not meeting GHS hazard criteria by 1866 of 1876 companies (only 0.5% companies provided GHS information). For more detailed information, please visit ECHA C&L website.",
      "es",
    )).toBe("No cumple los criterios de peligro del SGA según 1866 de 1876 empresas (solo el 0.5% de las empresas proporcionó información del SGA). Para más información, visita el sitio web de clasificación y etiquetado de la ECHA.");
    expect(localizeGhsClassificationNote(
      "Reported as not meeting GHS hazard criteria by 1 of 1 companies. For more detailed information, please visit ECHA C&L website.",
      "es",
    )).toBe("No cumple los criterios de peligro del SGA según 1 de 1 empresa. Para más información, visita el sitio web de clasificación y etiquetado de la ECHA.");
    expect(localizeGhsClassificationNote(
      "This chemical does not meet GHS hazard criteria for 99.5% (1866 of 1876) of all reports.",
      "es",
    )).toBe("Esta sustancia no cumple los criterios de peligro del SGA en el 99.5% de todos los informes (1866 de 1876).");
  });
});
