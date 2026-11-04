import { fmtCrossSection, fmtOneIn, measuredHalfLife } from "./nuclearFusion";
import { analyzeNucleus } from "./nuclear";
import { cureLabel, fmtTime, hazardWord, waterLabel, type Part as FormulaPart, type FormulaResult } from "./formula";
import { byId, localizeIngredient, type Role } from "./ingredients";
import { allBenchIngredients, localizeBenchIngredient } from "./bench/library";
import { CUSTOM_PREFIX } from "./bench/custom";
import type { Atmosphere, Experiment, RunResult } from "./bench/types";
import type { FusionReport } from "./nuclearFusion";
import { DEFAULT_LOCALE, tr, type Locale, type MessageKey } from "./i18n";

export interface ReportSection {
  heading: string;
  paragraph?: string;
  rows?: [label: string, value: string][];
  table?: { head: string[]; rows: string[][] };
  bullets?: string[];
  ruledLines?: number;
}

export interface LabReportDoc {
  title: string;
  kind: "bench" | "elements" | "formula";
  createdAt: Date;
  student?: string;
  question?: string;
  sections: ReportSection[];
  shareUrl?: string;
  disclaimer: string;
  locale?: Locale;
}

export interface TestSummary {
  name: string;
  setup: [string, string][];
  headline: string;
  metrics: { label: string; value: string }[];
  notes: string[];
}

export interface ReportExtra {
  student?: string;
  question?: string;
  shareUrl?: string;
  now?: Date;
  locale?: Locale;
}

function baseDoc(
  title: string,
  kind: LabReportDoc["kind"],
  extra: ReportExtra | undefined,
  disclaimer: string,
  sections: ReportSection[],
): LabReportDoc {
  const locale = extra?.locale ?? DEFAULT_LOCALE;
  return {
    title,
    kind,
    createdAt: extra?.now ?? new Date(),
    locale,
    ...(extra?.student ? { student: extra.student } : {}),
    ...(extra?.question ? { question: extra.question } : {}),
    sections: [
      ...(extra?.question ? [{ heading: tr(locale, "report.question"), paragraph: extra.question }] : []),
      ...sections,
    ],
    ...(extra?.shareUrl ? { shareUrl: extra.shareUrl } : {}),
    disclaimer,
  };
}

const FORMING_KEYS: Record<Experiment["conditions"]["forming"], MessageKey> = {
  beaker: "report.beaker",
  "extrude-air": "report.extrudeAir",
  "extrude-bath": "report.extrudeBath",
  "cast-film": "report.castFilm",
  "heat-cure": "report.heatCure",
};
const ATMOSPHERE_KEYS: Record<Atmosphere, MessageKey> = {
  air: "bench.model.compare.atmosphere.air",
  vacuum: "bench.model.compare.atmosphere.vacuum",
  nitrogen: "bench.model.compare.atmosphere.nitrogen",
};
const CATEGORY_KEYS: Record<string, MessageKey> = {
  element: "report.category.element",
  salt: "report.category.salt",
  protein: "report.category.protein",
  enzyme: "report.category.enzyme",
  polymer: "report.category.polymer",
  solvent: "report.category.solvent",
  "acid-base": "report.category.acidBase",
  additive: "report.category.additive",
  filler: "report.category.filler",
};
const ROLE_KEYS: Record<Role, MessageKey> = {
  polymer: "lab.role.polymer",
  crosslinker: "lab.role.crosslinker",
  adhesive: "lab.role.adhesive",
  plasticizer: "lab.role.plasticizer",
  solvent: "lab.role.solvent",
  filler: "lab.role.filler",
};
const EVENT_STATUS_KEYS: Record<string, MessageKey> = {
  happened: "bench.reaction.status.happened",
  partial: "bench.reaction.status.partial",
  blocked: "bench.reaction.status.blocked",
};
const EMISSION_KEYS: Record<FusionReport["emitted"][number]["type"], MessageKey> = {
  alpha: "report.emission.alpha",
  gamma: "report.emission.gamma",
  n: "report.emission.n",
  p: "report.emission.p",
  "e-": "report.emission.eMinus",
  "e+": "report.emission.ePlus",
  neutrino: "report.emission.neutrino",
};
const REPORT_LEVEL_KEYS: Record<string, MessageKey> = {
  bad: "report.level.bad",
  warn: "report.level.warn",
  good: "report.level.good",
};

function ingredientType(type: string | undefined, locale: Locale): string {
  if (type && type in ROLE_KEYS) return tr(locale, ROLE_KEYS[type as Role]);
  if (type && type in CATEGORY_KEYS) return tr(locale, CATEGORY_KEYS[type]);
  return type ?? tr(locale, "report.unknown");
}

export function benchReport(
  experiment: Experiment,
  result: RunResult,
  test?: TestSummary,
  extra?: ReportExtra,
  locale: Locale = DEFAULT_LOCALE,
): LabReportDoc {
  extra = { ...extra, locale };
  const ingredients = new Map(allBenchIngredients().map((ingredient) => [
    ingredient.id,
    localizeBenchIngredient(ingredient, locale),
  ]));
  const sections: ReportSection[] = [
    {
      heading: tr(locale, "report.materials"),
      table: {
        head: [tr(locale, "report.ingredient"), tr(locale, "report.type"), "%"],
        rows: experiment.parts.map((part) => {
          const ingredient = ingredients.get(part.id);
          const name = ingredient?.name ?? part.id;
          return [
            `${name}${part.id.startsWith(CUSTOM_PREFIX) ? tr(locale, "report.yourIngredient") : ""}`,
            ingredientType(ingredient?.category, locale),
            `${part.pct}%`,
          ];
        }),
      },
    },
    {
      heading: tr(locale, "report.method"),
      rows: [
        [tr(locale, "report.temperature"), `${experiment.conditions.tempC} °C`],
        [tr(locale, "report.pressure"), `${experiment.conditions.pressureKPa} kPa`],
        [tr(locale, "report.atmosphere"), tr(locale, ATMOSPHERE_KEYS[experiment.conditions.atmosphere])],
        [tr(locale, "report.humidity"), `${experiment.conditions.humidityPct}%`],
        [tr(locale, "report.mixing"), `${experiment.conditions.mixRpm} rpm × ${experiment.conditions.mixMinutes} min`],
        [tr(locale, "report.cureTime"), `${experiment.conditions.cureMinutes} min`],
        [tr(locale, "report.forming"), tr(locale, FORMING_KEYS[experiment.conditions.forming])],
        ...(experiment.conditions.bathId
          ? [[tr(locale, "report.bath"), ingredients.get(experiment.conditions.bathId)?.name ?? experiment.conditions.bathId] as [string, string]]
          : []),
        [tr(locale, "report.phFromIngredients"), result.effectivePH.toFixed(1)],
      ],
    },
    {
      heading: tr(locale, "report.results"),
      paragraph: `${result.productLabel}. ${result.summary}`,
      rows: [
        [tr(locale, "report.strength"), `${result.tensileMPa.toFixed(2)} MPa`],
        [tr(locale, "report.stretch"), `${result.elongationPct.toFixed(1)}%`],
        [tr(locale, "report.stickiness"), `${result.tack.toFixed(1)}/10`],
        [tr(locale, "report.toughness"), `${result.toughnessMJm3.toFixed(2)} MJ/m³`],
        [tr(locale, "report.setTime"), fmtTime(result.setSeconds, locale)],
        [tr(locale, "report.howDissolves"), `${waterLabel(result.water, locale)}; ${result.dissolveTime}`],
        [tr(locale, "report.costKg"), `$${result.costPerKg.toFixed(2)}`],
      ],
    },
    {
      heading: tr(locale, "report.whatHappened"),
      bullets: result.events.map(
        (event) =>
          `${event.name} (${EVENT_STATUS_KEYS[event.status] ? tr(locale, EVENT_STATUS_KEYS[event.status]) : event.status}): ${event.mechanism}${event.reasons.length ? ` ${event.reasons.join("; ")}` : ""}`,
      ),
    },
  ];

  if (test) {
    sections.push({
      heading: tr(locale, "report.testTitle", { name: test.name }),
      rows: [...test.setup, ...test.metrics.map(({ label, value }) => [label, value] as [string, string])],
      paragraph: test.headline,
      ...(test.notes.length ? { bullets: test.notes } : {}),
    });
  }

  sections.push(
    {
      heading: tr(locale, "report.safety"),
      rows: [
        [tr(locale, "report.wetToxicity"), hazardWord(result.wetToxicity, locale)],
        [tr(locale, "report.curedToxicity"), hazardWord(result.curedToxicity, locale)],
        [tr(locale, "report.skinContact"), hazardWord(result.skin, locale)],
        [tr(locale, "report.edible"), result.edible ? tr(locale, "report.yes") : tr(locale, "report.no")],
        [tr(locale, "report.biodegradable"), result.biodegradable ? tr(locale, "report.yes") : tr(locale, "report.no")],
      ],
      ...(result.warnings.length
        ? { bullets: result.warnings.map((warning) => `${warning.level}: ${warning.text}`) }
        : {}),
    },
    {
      heading: tr(locale, "report.modelLimits"),
      rows: [[tr(locale, "report.confidence"), `${Math.round(result.confidence * 100)}%`]],
      ...(result.notModelled.length ? { bullets: result.notModelled } : {}),
    },
    { heading: tr(locale, "report.notes"), ruledLines: 5 },
  );

  return baseDoc(
    tr(locale, "report.benchTitle", { product: result.productLabel }),
    "bench",
    extra,
    tr(locale, "report.benchDisclaimer"),
    sections,
  );
}

function formatMeasuredHalfLife(z: number, n: number, modelValue: string, locale: Locale): string {
  const measured = measuredHalfLife(z, n);
  if (measured === "stable") return tr(locale, "report.stableMeasured");
  if (measured !== undefined) return tr(locale, "report.measuredValue", { value: measured });
  return tr(locale, "report.modelValue", { value: modelValue });
}

function formatEmission(report: FusionReport, locale: Locale): string {
  return report.emitted.length
    ? report.emitted.map(({ type, count }) => `${count > 1 ? `${count} ` : ""}${tr(locale, EMISSION_KEYS[type])}`).join(", ")
    : tr(locale, "report.none");
}

export function nucleusReport(
  z: number,
  n: number,
  fusion?: { report: FusionReport; projectileLabel: string; beamLabMeV: number },
  extra?: ReportExtra,
  locale: Locale = DEFAULT_LOCALE,
): LabReportDoc {
  extra = { ...extra, locale };
  const nucleus = analyzeNucleus(z, n, locale);
  const hypothetical = z > 118 || !nucleus.known;
  const sections: ReportSection[] = [
    {
      heading: tr(locale, "report.nucleus"),
      rows: [
        [tr(locale, "report.element"), nucleus.name],
        [tr(locale, "report.symbol"), nucleus.symbol],
        [tr(locale, "report.zProtons"), `${z}`],
        [tr(locale, "report.nNeutrons"), `${n}`],
        [tr(locale, "report.aMassNumber"), `${nucleus.a}`],
        [
          tr(locale, "report.status"),
          hypothetical ? tr(locale, "report.hypothetical") : tr(locale, "report.knownElement"),
        ],
        [tr(locale, "report.halfLife"), formatMeasuredHalfLife(z, n, nucleus.halfLife, locale)],
        [tr(locale, "report.bindingEnergy"), `${nucleus.bindingMeV.toFixed(2)} MeV`],
        [tr(locale, "report.bindingEnergyPerNucleon"), `${nucleus.perNucleonMeV.toFixed(2)} MeV`],
        [tr(locale, "report.modes"), nucleus.modes.length ? nucleus.modes.join("; ") : tr(locale, "report.nonePredicted")],
        [tr(locale, "report.verdict"), nucleus.verdict],
        ["Q-alpha", `${nucleus.qAlpha.toFixed(2)} MeV`],
        ["Q-beta−", `${nucleus.qBetaMinus.toFixed(2)} MeV`],
        ["Q-beta+", `${nucleus.qBetaPlus.toFixed(2)} MeV`],
        ["Sn", `${nucleus.sn.toFixed(2)} MeV`],
        ["Sp", `${nucleus.sp.toFixed(2)} MeV`],
        [tr(locale, "report.fissility"), nucleus.fissility.toFixed(3)],
        [
          tr(locale, "report.magicNumbers"),
          [
            ...(nucleus.magicZ ? [`Z = ${z}`] : []),
            ...(nucleus.magicN ? [`N = ${n}`] : []),
          ].join(", ") || tr(locale, "report.neither"),
        ],
      ],
    },
  ];

  if (fusion) {
    const report = fusion.report;
    const noResidue = report.residue.length === 0;
    sections.push({
      heading: tr(locale, "report.fusion"),
      rows: [
        [tr(locale, "report.projectile"), fusion.projectileLabel],
        [tr(locale, "report.beamEnergy"), `${fusion.beamLabMeV.toPrecision(4)} MeV`],
        [tr(locale, "report.reaction"), report.reaction],
        [tr(locale, "report.headline"), report.headline],
        [tr(locale, "report.barrier"), `${report.barrierMeV.toFixed(2)} MeV`],
        ["E_cm", `${report.ecmMeV.toFixed(2)} MeV`],
        ["Q", `${report.qMeV.toFixed(2)} MeV`],
        ["E*", `${report.excitationMeV.toFixed(2)} MeV`],
        [tr(locale, "report.emitted"), formatEmission(report, locale)],
        [
          tr(locale, report.energyReleasedMeV < 0 ? "report.energyCost" : "report.energyReleased"),
          noResidue ? "—" : `${Math.abs(report.energyReleasedMeV).toFixed(2)} MeV`,
        ],
        [tr(locale, "report.chanceCollision"), fmtOneIn(report.chancePerCollision)],
        [tr(locale, "report.crossSection"), report.crossSectionBarn === undefined ? "—" : fmtCrossSection(report.crossSectionBarn)],
        [tr(locale, "report.atomsDay"), report.atomsPerDay === undefined ? "—" : report.atomsPerDay.toPrecision(3)],
        [
          tr(locale, "report.residue"),
          report.residue.length
            ? report.residue.map((item) => `${item.name} (${item.symbol}-${item.z + item.n})`).join(", ")
            : "—",
        ],
      ],
      ...(report.notes.length ? { bullets: report.notes } : {}),
    });
  }

  sections.push({ heading: tr(locale, "report.notes"), ruledLines: 5 });
  return baseDoc(
    tr(locale, "report.nucleusTitle", { name: nucleus.name, mass: nucleus.a }),
    "elements",
    extra,
    tr(locale, "report.fusionDisclaimer"),
    sections,
  );
}

export function formulaReport(
  parts: FormulaPart[],
  result: FormulaResult,
  extra?: ReportExtra,
  locale: Locale = DEFAULT_LOCALE,
): LabReportDoc {
  extra = { ...extra, locale };
  const sections: ReportSection[] = [
    {
      heading: tr(locale, "report.materials"),
      table: {
        head: [tr(locale, "report.ingredient"), tr(locale, "report.type"), "%"],
        rows: parts.map((part) => {
          const ingredient = byId[part.id];
          const localized = ingredient ? localizeIngredient(ingredient, locale) : undefined;
          return [localized?.name ?? part.id, ingredientType(ingredient?.role, locale), `${part.pct}%`];
        }),
      },
    },
    {
      heading: tr(locale, "report.results"),
      rows: [
        [tr(locale, "report.solids"), `${result.solidsPct.toFixed(1)}%`],
        [tr(locale, "report.strength"), `${result.tensileMPa.toFixed(2)} MPa`],
        [tr(locale, "report.stretch"), `${result.elongationPct.toFixed(1)}%`],
        [tr(locale, "report.toughness"), `${result.toughnessMJm3.toFixed(2)} MJ/m³`],
        [tr(locale, "report.stickiness"), `${result.tack.toFixed(1)}/10`],
        [tr(locale, "report.setTime"), fmtTime(result.cureSeconds, locale)],
        [tr(locale, "report.densityCured"), `${result.densityCured.toFixed(2)} g/cm³`],
        [tr(locale, "report.costKg"), `$${result.costPerKg.toFixed(2)}`],
        [tr(locale, "report.howDissolves"), `${waterLabel(result.water, locale)}; ${result.dissolveTime}`],
      ],
    },
    {
      heading: tr(locale, "report.cureMechanisms"),
      bullets: result.cure.map((mechanism) => cureLabel(mechanism, locale)),
    },
    { heading: tr(locale, "report.environment"), bullets: result.environment },
    {
      heading: tr(locale, "report.checks"),
      bullets: result.checks.map((check) => `${REPORT_LEVEL_KEYS[check.level] ? tr(locale, REPORT_LEVEL_KEYS[check.level]) : check.level}: ${check.text}`),
    },
    {
      heading: tr(locale, "report.safety"),
      rows: [
        [tr(locale, "report.wetToxicity"), hazardWord(result.wetToxicity, locale)],
        [tr(locale, "report.curedToxicity"), hazardWord(result.curedToxicity, locale)],
        [tr(locale, "report.skinContact"), hazardWord(result.skin, locale)],
        [tr(locale, "report.edible"), result.edible ? tr(locale, "report.yes") : tr(locale, "report.no")],
        [tr(locale, "report.biodegradable"), result.biodegradable ? tr(locale, "report.yes") : tr(locale, "report.no")],
      ],
    },
    { heading: tr(locale, "report.notes"), ruledLines: 5 },
  ];
  return baseDoc(
    tr(locale, "report.formulaTitle", {
      formula: parts.length
        ? parts.map((part) => {
            const ingredient = byId[part.id];
            return ingredient ? localizeIngredient(ingredient, locale).name : part.id;
          }).join(" + ")
        : tr(locale, "report.emptyFormula"),
    }),
    "formula",
    extra,
    tr(locale, "report.benchDisclaimer"),
    sections,
  );
}

const DIGIT_MAP: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

const WIN_ANSI_PUNCTUATION = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6,
  0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c,
  0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

function isWinAnsi(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_PUNCTUATION.has(code) ||
    character === "\n" ||
    character === "\r"
  );
}

export function pdfSafe(text: string): string {
  return Array.from(text, (character) => DIGIT_MAP[character] ?? character)
    .join("")
    .replaceAll("μ", "µ")
    .replaceAll("→", "->")
    .replaceAll("←", "<-")
    .replaceAll("α", "alpha")
    .replaceAll("β", "beta")
    .replaceAll("γ", "gamma")
    .replaceAll("ν", "nu")
    .replaceAll("σ", "sigma")
    .replaceAll("λ", "lambda")
    .replaceAll("π", "pi")
    .replaceAll("Δ", "Delta")
    .replaceAll("ħ", "hbar")
    .replaceAll("−", "-")
    .replaceAll("≥", ">=")
    .replaceAll("≤", "<=")
    .replaceAll("≈", "~")
    .replaceAll("∼", "~")
    .replaceAll("⁻", "-")
    .replaceAll("⁺", "+")
    .replaceAll("✓", "OK")
    .replace(/[^\r\n]/g, (character) => (isWinAnsi(character) ? character : "?"));
}

function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function reportFileName(doc: LabReportDoc): string {
  const kind = slug(doc.kind);
  const title = slug(doc.title).slice(0, 40).replace(/-+$/g, "") || "report";
  return `science-lab-${kind}-${title}-${doc.createdAt.toISOString().slice(0, 10)}.pdf`;
}
