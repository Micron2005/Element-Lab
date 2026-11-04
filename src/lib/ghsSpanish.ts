import type { Locale } from "./i18n";
import { tr } from "./i18n";

export const GHS_HAZARD_STATEMENTS_ES: Record<string, string> = {
  H200: "Explosivo inestable.",
  H201: "Explosivo; peligro de explosión en masa.",
  H202: "Explosivo; grave peligro de proyección.",
  H203: "Explosivo; peligro de incendio, de onda expansiva o de proyección.",
  H204: "Peligro de incendio o de proyección.",
  H205: "Peligro de explosión en masa en caso de incendio.",
  H206: "Peligro de incendio, de onda expansiva o de proyección; mayor riesgo de explosión si disminuye el agente insensibilizante.",
  H207: "Peligro de incendio o de proyección; mayor riesgo de explosión si disminuye el agente insensibilizante.",
  H208: "Peligro de incendio; mayor riesgo de explosión si disminuye el agente insensibilizante.",
  H209: "Explosivo.",
  H210: "Explosivo muy insensible.",
  H211: "Explosivo insensible.",
  H220: "Gas extremadamente inflamable.",
  H221: "Gas inflamable.",
  H222: "Aerosol extremadamente inflamable.",
  H223: "Aerosol inflamable.",
  H224: "Líquido y vapores extremadamente inflamables.",
  H225: "Líquido y vapores muy inflamables.",
  H226: "Líquido y vapores inflamables.",
  H227: "Líquido combustible.",
  H228: "Sólido inflamable.",
  H229: "Recipiente a presión: puede reventar si se calienta.",
  H230: "Puede explotar incluso en ausencia de aire.",
  H231: "Puede explotar incluso en ausencia de aire, a presión o temperatura elevadas.",
  H232: "Puede inflamarse espontáneamente al contacto con el aire.",
  H240: "El calentamiento puede provocar una explosión.",
  H241: "El calentamiento puede provocar un incendio o una explosión.",
  H242: "El calentamiento puede provocar un incendio.",
  H250: "Se inflama espontáneamente en contacto con el aire.",
  H251: "Se calienta espontáneamente; puede inflamarse.",
  H252: "Se calienta espontáneamente en grandes cantidades; puede inflamarse.",
  H260: "En contacto con el agua desprende gases inflamables que pueden inflamarse espontáneamente.",
  H261: "En contacto con el agua desprende gases inflamables.",
  H270: "Puede provocar o agravar un incendio; comburente.",
  H271: "Puede provocar un incendio o una explosión; muy comburente.",
  H272: "Puede agravar un incendio; comburente.",
  H280: "Contiene gas a presión; peligro de explosión en caso de calentamiento.",
  H281: "Contiene gas refrigerado; puede provocar quemaduras o lesiones criogénicas.",
  H290: "Puede ser corrosivo para los metales.",
  H300: "Mortal en caso de ingestión.",
  H301: "Tóxico en caso de ingestión.",
  H302: "Nocivo en caso de ingestión.",
  H303: "Puede ser nocivo en caso de ingestión.",
  H304: "Puede ser mortal en caso de ingestión y de penetración en las vías respiratorias.",
  H305: "Puede ser nocivo en caso de ingestión y de penetración en las vías respiratorias.",
  H310: "Mortal en contacto con la piel.",
  H311: "Tóxico en contacto con la piel.",
  H312: "Nocivo en contacto con la piel.",
  H313: "Puede ser nocivo en contacto con la piel.",
  H314: "Provoca graves quemaduras en la piel y lesiones oculares.",
  H315: "Provoca irritación cutánea.",
  H316: "Provoca una leve irritación cutánea.",
  H317: "Puede provocar una reacción cutánea alérgica.",
  H318: "Provoca lesiones oculares graves.",
  H319: "Provoca irritación ocular grave.",
  H320: "Provoca irritación ocular.",
  H330: "Mortal si se inhala.",
  H331: "Tóxico si se inhala.",
  H332: "Nocivo si se inhala.",
  H333: "Puede ser nocivo si se inhala.",
  H334: "Puede provocar síntomas de alergia o asma o dificultades respiratorias si se inhala.",
  H335: "Puede irritar las vías respiratorias.",
  H336: "Puede provocar somnolencia o vértigo.",
  H340: "Puede provocar defectos genéticos.",
  H341: "Se sospecha que provoca defectos genéticos.",
  H350: "Puede provocar cáncer.",
  H351: "Susceptible de provocar cáncer.",
  H360: "Puede perjudicar la fertilidad o dañar al feto.",
  H361: "Susceptible de perjudicar la fertilidad o dañar al feto.",
  H362: "Puede ser nocivo para los lactantes.",
  H370: "Provoca daños en los órganos (o indíquense todos los órganos afectados, si se conocen).",
  H371: "Puede provocar daños en los órganos (o indíquense todos los órganos afectados, si se conocen).",
  H372: "Provoca daños en los órganos tras exposiciones prolongadas o repetidas.",
  H373: "Puede provocar daños en los órganos tras exposiciones prolongadas o repetidas.",
  H400: "Muy tóxico para los organismos acuáticos.",
  H401: "Tóxico para los organismos acuáticos.",
  H402: "Nocivo para los organismos acuáticos.",
  H410: "Muy tóxico para los organismos acuáticos, con efectos nocivos duraderos.",
  H411: "Tóxico para los organismos acuáticos, con efectos nocivos duraderos.",
  H412: "Nocivo para los organismos acuáticos, con efectos nocivos duraderos.",
  H413: "Puede ser nocivo para los organismos acuáticos, con efectos nocivos duraderos.",
  H420: "Causa daños a la salud pública y el medio ambiente al destruir el ozono en la atmósfera superior.",
};

export const GHS_PICTOGRAMS_ES: Record<string, string> = {
  "Exploding bomb": "Bomba explotando",
  Flame: "Inflamable",
  Flammable: "Inflamable",
  "Flame over circle": "Comburente",
  Oxidizer: "Comburente",
  "Gas cylinder": "Gas a presión",
  Corrosion: "Corrosivo",
  "Skull and crossbones": "Tóxico",
  "Exclamation mark": "Irritante",
  Irritant: "Irritante",
  "Health hazard": "Peligro para la salud",
  "Environment": "Peligroso para el medio ambiente",
};

export const GHS_SIGNAL_WORDS_ES: Record<string, string> = {
  Danger: "Peligro",
  Warning: "Atención",
  "Not Classified": "No clasificado",
};

export function localizeGhsSignalWord(value: string | null, locale: Locale): string | null {
  if (!value || locale !== "es") return value;
  return GHS_SIGNAL_WORDS_ES[value] ?? value;
}

export function localizeGhsPictogram(value: string, locale: Locale): string {
  if (locale !== "es") return value;
  return GHS_PICTOGRAMS_ES[value] ?? value;
}

export function localizeGhsHazardStatement(value: string, locale: Locale): string {
  if (locale !== "es") return value;
  if (value === tr("en", "chem.ghsNotClassified")) return tr(locale, "chem.ghsNotClassified");
  const match = value.match(/^(H\d{3})([^:]*):\s*(.*)$/i);
  if (!match) return value;
  const [, code, qualifier] = match;
  const spanish = GHS_HAZARD_STATEMENTS_ES[code.toUpperCase()];
  return spanish ? `${code}${qualifier}: ${spanish}` : value;
}

export function localizeGhsClassificationNote(value: string, locale: Locale): string {
  if (locale !== "es") return value;
  if (value === tr("en", "chem.ghsNotClassified")) return tr(locale, "chem.ghsNotClassified");
  const match = value.match(
    /(?:reported as not meeting GHS hazard criteria by|does not meet GHS hazard criteria for)\s*(?:<\s*[\d.]+%\s*)?\(?([\d,]+)\s+of\s+([\d,]+)\)?(?:\s+of)?\s+(companies|reports)/i,
  );
  if (!match) return value;
  const source = match[3].toLowerCase() === "companies"
    ? tr(locale, "chem.ghsCompanies")
    : tr(locale, "chem.ghsReports");
  return tr(locale, "chem.ghsNotClassifiedReports", {
    reported: match[1],
    total: match[2],
    source,
  });
}
