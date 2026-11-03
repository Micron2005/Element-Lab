import { fmtCrossSection, fmtOneIn, measuredHalfLife } from "./nuclearFusion";
import { analyzeNucleus } from "./nuclear";
import { fmtTime, hazardWord, type Part as FormulaPart, type FormulaResult } from "./formula";
import { byId, type CureMechanism } from "./ingredients";
import { allBenchIngredients } from "./bench/library";
import { CUSTOM_PREFIX } from "./bench/custom";
import type { Experiment, RunResult } from "./bench/types";
import type { FusionReport } from "./nuclearFusion";

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
  kind: "Bench" | "Elements" | "Formula Lab";
  createdAt: Date;
  student?: string;
  question?: string;
  sections: ReportSection[];
  shareUrl?: string;
  disclaimer: string;
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
}

const BENCH_DISCLAIMER =
  "Estimate from Element Lab's rule-based model, not a lab measurement. Don't make or handle this mix for real without a qualified supervisor.";
const FUSION_DISCLAIMER =
  "liquid-drop model, no shell corrections, and real values can differ a lot.";

function baseDoc(
  title: string,
  kind: LabReportDoc["kind"],
  extra: ReportExtra | undefined,
  disclaimer: string,
  sections: ReportSection[],
): LabReportDoc {
  return {
    title,
    kind,
    createdAt: extra?.now ?? new Date(),
    ...(extra?.student ? { student: extra.student } : {}),
    ...(extra?.question ? { question: extra.question } : {}),
    sections: [
      ...(extra?.question ? [{ heading: "Question", paragraph: extra.question }] : []),
      ...sections,
    ],
    ...(extra?.shareUrl ? { shareUrl: extra.shareUrl } : {}),
    disclaimer,
  };
}

const FORMING_LABELS: Record<Experiment["conditions"]["forming"], string> = {
  beaker: "Beaker",
  "extrude-air": "Extrude into air",
  "extrude-bath": "Extrude into bath",
  "cast-film": "Cast film",
  "heat-cure": "Heat cure",
};

export function benchReport(
  experiment: Experiment,
  result: RunResult,
  test?: TestSummary,
  extra?: ReportExtra,
): LabReportDoc {
  const ingredients = new Map(allBenchIngredients().map((ingredient) => [ingredient.id, ingredient]));
  const sections: ReportSection[] = [
    {
      heading: "Materials",
      table: {
        head: ["Ingredient", "Type", "%"],
        rows: experiment.parts.map((part) => {
          const ingredient = ingredients.get(part.id);
          const name = ingredient?.name ?? part.id;
          return [
            `${name}${part.id.startsWith(CUSTOM_PREFIX) ? " (your ingredient)" : ""}`,
            ingredient?.category ?? "Unknown",
            `${part.pct}%`,
          ];
        }),
      },
    },
    {
      heading: "Method",
      rows: [
        ["Temperature", `${experiment.conditions.tempC} °C`],
        ["Pressure", `${experiment.conditions.pressureKPa} kPa`],
        ["Atmosphere", experiment.conditions.atmosphere],
        ["Humidity", `${experiment.conditions.humidityPct}%`],
        ["Mixing", `${experiment.conditions.mixRpm} rpm × ${experiment.conditions.mixMinutes} min`],
        ["Cure time", `${experiment.conditions.cureMinutes} min`],
        ["Forming", FORMING_LABELS[experiment.conditions.forming]],
        ...(experiment.conditions.bathId
          ? [["Bath", ingredients.get(experiment.conditions.bathId)?.name ?? experiment.conditions.bathId] as [string, string]]
          : []),
        ["pH (from ingredients)", result.effectivePH.toFixed(1)],
      ],
    },
    {
      heading: "Results",
      paragraph: `${result.productLabel}. ${result.summary}`,
      rows: [
        ["Strength", `${result.tensileMPa.toFixed(2)} MPa`],
        ["Stretch", `${result.elongationPct.toFixed(1)}%`],
        ["Stickiness", `${result.tack.toFixed(1)}/10`],
        ["Toughness", `${result.toughnessMJm3.toFixed(2)} MJ/m³`],
        ["Set time", fmtTime(result.setSeconds)],
        ["How it dissolves", `${result.water}; ${result.dissolveTime}`],
        ["Cost/kg", `$${result.costPerKg.toFixed(2)}`],
      ],
    },
    {
      heading: "What happened",
      bullets: result.events.map(
        (event) =>
          `${event.name} (${event.status}): ${event.mechanism}${event.reasons.length ? ` ${event.reasons.join("; ")}` : ""}`,
      ),
    },
  ];

  if (test) {
    sections.push({
      heading: `Test: ${test.name}`,
      rows: [...test.setup, ...test.metrics.map(({ label, value }) => [label, value] as [string, string])],
      paragraph: test.headline,
      ...(test.notes.length ? { bullets: test.notes } : {}),
    });
  }

  sections.push(
    {
      heading: "Safety",
      rows: [
        ["Wet toxicity", hazardWord(result.wetToxicity)],
        ["Cured toxicity", hazardWord(result.curedToxicity)],
        ["Skin contact", hazardWord(result.skin)],
        ["Edible", result.edible ? "Yes" : "No"],
        ["Biodegradable", result.biodegradable ? "Yes" : "No"],
      ],
      ...(result.warnings.length
        ? { bullets: result.warnings.map((warning) => `${warning.level}: ${warning.text}`) }
        : {}),
    },
    {
      heading: "Model limits",
      rows: [["Confidence", `${Math.round(result.confidence * 100)}%`]],
      ...(result.notModelled.length ? { bullets: result.notModelled } : {}),
    },
    { heading: "Notes", ruledLines: 5 },
  );

  return baseDoc(
    `Bench experiment: ${result.productLabel}`,
    "Bench",
    extra,
    BENCH_DISCLAIMER,
    sections,
  );
}

function formatMeasuredHalfLife(z: number, n: number, modelValue: string): string {
  const measured = measuredHalfLife(z, n);
  if (measured === "stable") return "Stable (measured)";
  if (measured !== undefined) return `${measured} (measured)`;
  return `${modelValue} (model)`;
}

function formatEmission(report: FusionReport): string {
  return report.emitted.length
    ? report.emitted.map(({ type, count }) => `${count > 1 ? `${count} ` : ""}${type}`).join(", ")
    : "None";
}

export function nucleusReport(
  z: number,
  n: number,
  fusion?: { report: FusionReport; projectileLabel: string; beamLabMeV: number },
  extra?: ReportExtra,
): LabReportDoc {
  const nucleus = analyzeNucleus(z, n);
  const hypothetical = z > 118 || !nucleus.known;
  const sections: ReportSection[] = [
    {
      heading: "Nucleus",
      rows: [
        ["Element", nucleus.name],
        ["Symbol", nucleus.symbol],
        ["Z (protons)", `${z}`],
        ["N (neutrons)", `${n}`],
        ["A (mass number)", `${nucleus.a}`],
        [
          "Status",
          hypothetical ? "Hypothetical: a model prediction, not a discovered element" : "Known element",
        ],
        ["Half-life", formatMeasuredHalfLife(z, n, nucleus.halfLife)],
        ["Binding energy", `${nucleus.bindingMeV.toFixed(2)} MeV`],
        ["Binding energy per nucleon", `${nucleus.perNucleonMeV.toFixed(2)} MeV`],
        ["Modes", nucleus.modes.length ? nucleus.modes.join("; ") : "None predicted"],
        ["Verdict", nucleus.verdict],
        ["Q-alpha", `${nucleus.qAlpha.toFixed(2)} MeV`],
        ["Q-beta−", `${nucleus.qBetaMinus.toFixed(2)} MeV`],
        ["Q-beta+", `${nucleus.qBetaPlus.toFixed(2)} MeV`],
        ["Sn", `${nucleus.sn.toFixed(2)} MeV`],
        ["Sp", `${nucleus.sp.toFixed(2)} MeV`],
        ["Fissility", nucleus.fissility.toFixed(3)],
        [
          "Magic numbers",
          [
            ...(nucleus.magicZ ? [`Z = ${z}`] : []),
            ...(nucleus.magicN ? [`N = ${n}`] : []),
          ].join(", ") || "Neither",
        ],
      ],
    },
  ];

  if (fusion) {
    const report = fusion.report;
    const noResidue = report.residue.length === 0;
    sections.push({
      heading: "Fusion",
      rows: [
        ["Projectile", fusion.projectileLabel],
        ["Beam energy (lab)", `${fusion.beamLabMeV.toPrecision(4)} MeV`],
        ["Reaction", report.reaction],
        ["Headline", report.headline],
        ["Barrier", `${report.barrierMeV.toFixed(2)} MeV`],
        ["E_cm", `${report.ecmMeV.toFixed(2)} MeV`],
        ["Q", `${report.qMeV.toFixed(2)} MeV`],
        ["E*", `${report.excitationMeV.toFixed(2)} MeV`],
        ["Emitted", formatEmission(report)],
        [
          report.energyReleasedMeV < 0 ? "Energy cost" : "Energy released",
          noResidue ? "—" : `${Math.abs(report.energyReleasedMeV).toFixed(2)} MeV`,
        ],
        ["Chance per collision", fmtOneIn(report.chancePerCollision)],
        ["Cross section", report.crossSectionBarn === undefined ? "—" : fmtCrossSection(report.crossSectionBarn)],
        ["Atoms/day", report.atomsPerDay === undefined ? "—" : report.atomsPerDay.toPrecision(3)],
        [
          "Residue",
          report.residue.length
            ? report.residue.map((item) => `${item.name} (${item.symbol}-${item.z + item.n})`).join(", ")
            : "—",
        ],
      ],
      ...(report.notes.length ? { bullets: report.notes } : {}),
    });
  }

  sections.push({ heading: "Notes", ruledLines: 5 });
  return baseDoc(
    `Nucleus: ${nucleus.name}-${nucleus.a}`,
    "Elements",
    extra,
    FUSION_DISCLAIMER,
    sections,
  );
}

const CURE_LABELS: Record<CureMechanism, string> = {
  evaporation: "Solvent evaporates, leaving chains behind",
  "ionic-bath": "Ions bridge chains into a gel",
  moisture: "Humidity triggers a chemical cure",
  anionic: "Trace moisture starts a rapid chain reaction",
  shear: "Flow aligns and locks the molecules",
  cooling: "The melt or gel firms as it cools",
  covalent: "New covalent links join the chains",
  none: "No active setting mechanism",
};

export function formulaReport(
  parts: FormulaPart[],
  result: FormulaResult,
  extra?: ReportExtra,
): LabReportDoc {
  const sections: ReportSection[] = [
    {
      heading: "Materials",
      table: {
        head: ["Ingredient", "Type", "%"],
        rows: parts.map((part) => {
          const ingredient = byId[part.id];
          return [ingredient?.name ?? part.id, ingredient?.role ?? "Unknown", `${part.pct}%`];
        }),
      },
    },
    {
      heading: "Results",
      rows: [
        ["Solids", `${result.solidsPct.toFixed(1)}%`],
        ["Strength", `${result.tensileMPa.toFixed(2)} MPa`],
        ["Stretch", `${result.elongationPct.toFixed(1)}%`],
        ["Toughness", `${result.toughnessMJm3.toFixed(2)} MJ/m³`],
        ["Stickiness", `${result.tack.toFixed(1)}/10`],
        ["Set time", fmtTime(result.cureSeconds)],
        ["Density (cured)", `${result.densityCured.toFixed(2)} g/cm³`],
        ["Cost/kg", `$${result.costPerKg.toFixed(2)}`],
        ["How it dissolves", `${result.water}; ${result.dissolveTime}`],
      ],
    },
    {
      heading: "Cure mechanisms",
      bullets: result.cure.map((mechanism) => CURE_LABELS[mechanism]),
    },
    { heading: "Environment", bullets: result.environment },
    {
      heading: "Checks",
      bullets: result.checks.map((check) => `${check.level}: ${check.text}`),
    },
    {
      heading: "Safety",
      rows: [
        ["Wet toxicity", hazardWord(result.wetToxicity)],
        ["Cured toxicity", hazardWord(result.curedToxicity)],
        ["Skin contact", hazardWord(result.skin)],
        ["Edible", result.edible ? "Yes" : "No"],
        ["Biodegradable", result.biodegradable ? "Yes" : "No"],
      ],
    },
    { heading: "Notes", ruledLines: 5 },
  ];
  return baseDoc(
    `Formula Lab: ${parts.length ? parts.map((part) => byId[part.id]?.name ?? part.id).join(" + ") : "Empty formula"}`,
    "Formula Lab",
    extra,
    BENCH_DISCLAIMER,
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
  return `element-lab-${kind}-${title}-${doc.createdAt.toISOString().slice(0, 10)}.pdf`;
}
