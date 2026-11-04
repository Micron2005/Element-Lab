"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_DROP,
  DEFAULT_DISSOLVE,
  DEFAULT_HEAT,
  DEFAULT_STICK,
  DEFAULT_STRETCH,
  STICK_SURFACE_LABELS,
  dissolveTest,
  dropTest,
  heatTest,
  stickTest,
  stretchTest,
  type DissolveLiquid,
  type DropFloor,
  type StickSurface,
  type TestReport,
} from "@/lib/bench/materialTests";
import type { Experiment, RunResult } from "@/lib/bench/types";
import type { BenchTestId } from "@/lib/share";
import type { TestSummary } from "@/lib/labReport";
import ShootTest from "./ShootTest";
import RangeNumberField from "./RangeNumberField";
import TestViewer, { type TestViewerData } from "./TestViewer";
import { Term } from "./Term";
import { useT } from "./LocaleProvider";

const TEST_STORAGE = "elementlab.bench.test";
const TESTS: { id: BenchTestId; label: string }[] = [
  { id: "shoot", label: "bench.test.nozzle" },
  { id: "stretch", label: "bench.test.stretch" },
  { id: "heat", label: "bench.test.heat" },
  { id: "dissolve", label: "bench.test.dissolve" },
  { id: "stick", label: "bench.test.stick" },
  { id: "drop", label: "bench.test.drop" },
];
const VALID_TESTS = new Set<BenchTestId>(TESTS.map(({ id }) => id));

function TestResultCard({
  kicker,
  heading,
  controls,
  viewer,
  report,
}: {
  kicker: string;
  heading: string;
  controls: ReactNode;
  viewer: TestViewerData;
  report: TestReport<string>;
}) {
  const { t } = useT();
  return (
    <article className="bench-shoot-card bench-test-card" aria-label={t("bench.test.aria", { test: t(heading) })}>
      <header className="bench-test-card-heading">
        <div>
          <p className="bench-test-kicker">{t(kicker)}</p>
          <h4>{heading === "bench.test.stretch" ? <Term id="stretch">{t(heading)}</Term> : t(heading)}</h4>
        </div>
        <span className="bench-test-setup-label">{t("bench.test.setupOnly")}</span>
      </header>
      <div className="bench-test-controls">{controls}</div>
      <TestViewer key={`${viewer.type}-${JSON.stringify(viewer.setup)}-${report.verdict}`} data={viewer} />
      <div className={`bench-test-verdict tone-${report.tone}`}>
        <strong>{t(`bench.test.status.${report.verdict}`)}</strong>
        <p>{report.headline}</p>
      </div>
      <dl className="bench-metric-grid bench-test-metrics">
        {report.metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
        <div>
            <dt>{t("bench.test.modelConfidence")}</dt>
          <dd>{Math.round(report.confidence * 100)}%</dd>
        </div>
      </dl>
      {report.notes.length > 0 && (
        <ul className="bench-test-notes">
          {report.notes.map((note, index) => (
            <li key={`${index}-${note}`}>{note}</li>
          ))}
        </ul>
      )}
      <p className="bench-test-footnote">{t("bench.test.footnote")}</p>
    </article>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="bench-test-control">
      <span className="bench-test-control-label">{label}</span>
      <div className="bench-test-choice-group" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="button button-secondary"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BenchTests({
  experiment,
  result,
  runId,
  shareTestId = null,
  onTestSummary,
}: {
  experiment: Experiment;
  result: RunResult;
  runId: number;
  shareTestId?: BenchTestId | null;
  onTestSummary?: (summary: TestSummary | null) => void;
}) {
  const { locale, t } = useT();
  const [selected, setSelected] = useState<BenchTestId>(() =>
    shareTestId && VALID_TESTS.has(shareTestId) ? shareTestId : "shoot",
  );
  const [storageReady, setStorageReady] = useState(false);
  const [stretchSetup, setStretchSetup] = useState(DEFAULT_STRETCH);
  const [heatSetup, setHeatSetup] = useState(DEFAULT_HEAT);
  const [dissolveSetup, setDissolveSetup] = useState(DEFAULT_DISSOLVE);
  const [stickSetup, setStickSetup] = useState(DEFAULT_STICK);
  const [dropSetup, setDropSetup] = useState(DEFAULT_DROP);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(TEST_STORAGE);
        if (stored && VALID_TESTS.has(stored as BenchTestId)) {
          setSelected(stored as BenchTestId);
        }
      } catch {
        setStorageReady(true);
      }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(TEST_STORAGE, selected);
    } catch {
      return;
    }
  }, [selected, storageReady]);

  const stretch = useMemo(
    () => stretchTest(experiment, result, stretchSetup, locale),
    [experiment, result, stretchSetup, locale],
  );
  const heat = useMemo(
    () => heatTest(experiment, result, heatSetup, locale),
    [experiment, result, heatSetup, locale],
  );
  const dissolve = useMemo(
    () => dissolveTest(experiment, result, dissolveSetup, locale),
    [experiment, result, dissolveSetup, locale],
  );
  const stick = useMemo(
    () => stickTest(experiment, result, stickSetup, locale),
    [experiment, result, stickSetup, locale],
  );
  const drop = useMemo(
    () => dropTest(experiment, result, dropSetup, locale),
    [experiment, result, dropSetup, locale],
  );
  const selectedSummary = useMemo<TestSummary | null>(() => {
    if (selected === "shoot") return null;
    if (selected === "stretch") {
      return {
        name: t("bench.test.stretch"),
        setup: [
          [t("bench.test.strandDiameter"), `${stretchSetup.diameterMm} mm`],
          [t("bench.test.startingLength"), `${stretchSetup.lengthMm} mm`],
          [t("bench.test.pullSpeed"), `${stretchSetup.pullMmPerMin} mm/min`],
        ],
        headline: stretch.headline,
        metrics: stretch.metrics,
        notes: stretch.notes,
      };
    }
    if (selected === "heat") {
      return {
        name: t("bench.test.heat"),
        setup: [
          [t("bench.test.maximumTemperature"), `${heatSetup.maxTempC} °C`],
          [t("bench.test.timeAtTemperature"), `${heatSetup.minutes} min`],
          [t("bench.test.atmosphere"), t(`bench.test.${heatSetup.atmosphere}`)],
        ],
        headline: heat.headline,
        metrics: heat.metrics,
        notes: heat.notes,
      };
    }
    if (selected === "dissolve") {
      return {
        name: t("bench.test.dissolve"),
        setup: [
          [t("bench.test.liquid"), t(`bench.test.${dissolveSetup.liquid === "salt-water" ? "saltWater" : dissolveSetup.liquid}`)],
          [t("bench.test.liquidTemperature"), `${dissolveSetup.tempC} °C`],
          [t("bench.test.sampleThickness"), `${dissolveSetup.thicknessMm} mm`],
          [t("bench.test.stirredLabel"), dissolveSetup.stirred ? t("bench.model.material.yes") : t("bench.model.material.no")],
        ],
        headline: dissolve.headline,
        metrics: dissolve.metrics,
        notes: dissolve.notes,
      };
    }
    if (selected === "stick") {
      return {
        name: t("bench.test.stick"),
        setup: [
          [t("bench.test.surface"), t(`bench.test.${stickSetup.surface}`)],
          [t("bench.test.contactArea"), `${stickSetup.areaCm2} cm²`],
          [t("bench.test.pressTime"), `${stickSetup.pressMinutes} min`],
        ],
        headline: stick.headline,
        metrics: stick.metrics,
        notes: stick.notes,
      };
    }
    return {
      name: t("bench.test.drop"),
      setup: [
        [t("bench.test.dropHeight"), `${dropSetup.heightM} m`],
        [t("bench.test.sampleDiameter"), `${dropSetup.diameterMm} mm`],
        [t("bench.test.floor"), t(`bench.test.${dropSetup.floor}`)],
      ],
      headline: drop.headline,
      metrics: drop.metrics,
      notes: drop.notes,
    };
  }, [selected, stretchSetup, stretch, heatSetup, heat, dissolveSetup, dissolve, stickSetup, stick, dropSetup, drop, t]);

  useEffect(() => {
    if (selected !== "shoot") onTestSummary?.(selectedSummary);
  }, [onTestSummary, selected, selectedSummary]);

  let card: ReactNode;
  if (selected === "shoot") {
    card = (
      <div className="bench-test-shoot-wrap">
        <ShootTest key={runId} experiment={experiment} result={result} onTestSummary={onTestSummary} />
        <p className="bench-test-footnote">{t("bench.test.estimateNote")}</p>
      </div>
    );
  } else if (selected === "stretch") {
    card = (
      <TestResultCard
        kicker="bench.test.pullKicker"
        heading="bench.test.stretch"
        report={stretch}
        viewer={{ type: "stretch", setup: stretchSetup, report: stretch }}
        controls={
          <>
            <RangeNumberField
              label={t("bench.test.strandDiameter")}
              value={stretchSetup.diameterMm}
              min={0.05}
              max={20}
              step={0.05}
              unit="mm"
              onChange={(diameterMm) => setStretchSetup((current) => ({ ...current, diameterMm }))}
            />
            <RangeNumberField
              label={t("bench.test.startingLength")}
              value={stretchSetup.lengthMm}
              min={10}
              max={1000}
              step={1}
              unit="mm"
              onChange={(lengthMm) => setStretchSetup((current) => ({ ...current, lengthMm }))}
            />
            <RangeNumberField
              label={t("bench.test.pullSpeed")}
              value={stretchSetup.pullMmPerMin}
              min={1}
              max={10000}
              step={1}
              unit="mm/min"
              onChange={(pullMmPerMin) =>
                setStretchSetup((current) => ({ ...current, pullMmPerMin }))
              }
            />
          </>
        }
      />
    );
  } else if (selected === "heat") {
    card = (
      <TestResultCard
        kicker="bench.test.heatKicker"
        heading="bench.test.heat"
        report={heat}
        viewer={{ type: "heat", setup: heatSetup, report: heat }}
        controls={
          <>
            <RangeNumberField
              label={t("bench.test.maximumTemperature")}
              value={heatSetup.maxTempC}
              min={25}
              max={1000}
              step={1}
              unit="°C"
              onChange={(maxTempC) => setHeatSetup((current) => ({ ...current, maxTempC }))}
            />
            <RangeNumberField
              label={t("bench.test.timeAtTemperature")}
              value={heatSetup.minutes}
              min={1}
              max={120}
              step={1}
              unit="min"
              onChange={(minutes) => setHeatSetup((current) => ({ ...current, minutes }))}
            />
            <ChoiceGroup
              label={t("bench.test.atmosphere")}
              value={heatSetup.atmosphere}
              options={[
                { value: "air", label: t("bench.test.air") },
                { value: "nitrogen", label: t("bench.test.nitrogen") },
              ]}
              onChange={(atmosphere) => setHeatSetup((current) => ({ ...current, atmosphere }))}
            />
          </>
        }
      />
    );
  } else if (selected === "dissolve") {
    const liquids: { value: DissolveLiquid; label: string }[] = [
      { value: "water", label: t("bench.test.water") },
      { value: "salt-water", label: t("bench.test.saltWater") },
      { value: "acidic", label: t("bench.test.acidic") },
      { value: "alkaline", label: t("bench.test.alkaline") },
    ];
    card = (
      <TestResultCard
        kicker="bench.test.waterKicker"
        heading="bench.test.dissolve"
        report={dissolve}
        viewer={{ type: "dissolve", setup: dissolveSetup, report: dissolve }}
        controls={
          <>
            <ChoiceGroup
              label={t("bench.test.liquid")}
              value={dissolveSetup.liquid}
              options={liquids}
              onChange={(liquid) => setDissolveSetup((current) => ({ ...current, liquid }))}
            />
            <RangeNumberField
              label={t("bench.test.liquidTemperature")}
              value={dissolveSetup.tempC}
              min={0}
              max={100}
              step={1}
              unit="°C"
              onChange={(tempC) => setDissolveSetup((current) => ({ ...current, tempC }))}
            />
            <RangeNumberField
              label={t("bench.test.sampleThickness")}
              value={dissolveSetup.thicknessMm}
              min={0.01}
              max={50}
              step={0.01}
              unit="mm"
              onChange={(thicknessMm) =>
                setDissolveSetup((current) => ({ ...current, thicknessMm }))
              }
            />
            <button
              type="button"
              className="button button-secondary bench-test-toggle"
              aria-pressed={dissolveSetup.stirred}
              onClick={() =>
                setDissolveSetup((current) => ({ ...current, stirred: !current.stirred }))
              }
            >
              {dissolveSetup.stirred ? t("bench.test.stirredLabel") : t("bench.test.notStirred")}
            </button>
          </>
        }
      />
    );
  } else if (selected === "stick") {
    const surfaces: { value: StickSurface; label: string }[] = (
      Object.keys(STICK_SURFACE_LABELS) as StickSurface[]
    ).map((value) => ({ value, label: t(`bench.test.${value}`) }));
    card = (
      <TestResultCard
        kicker="bench.test.stickKicker"
        heading="bench.test.stick"
        report={stick}
        viewer={{ type: "stick", setup: stickSetup, report: stick }}
        controls={
          <>
            <ChoiceGroup
              label={t("bench.test.surface")}
              value={stickSetup.surface}
              options={surfaces}
              onChange={(surface) => setStickSetup((current) => ({ ...current, surface }))}
            />
            <RangeNumberField
              label={t("bench.test.contactArea")}
              value={stickSetup.areaCm2}
              min={0.1}
              max={100}
              step={0.1}
              unit="cm²"
              onChange={(areaCm2) => setStickSetup((current) => ({ ...current, areaCm2 }))}
            />
            <RangeNumberField
              label={t("bench.test.pressTime")}
              value={stickSetup.pressMinutes}
              min={0}
              max={1440}
              step={1}
              unit="min"
              onChange={(pressMinutes) =>
                setStickSetup((current) => ({ ...current, pressMinutes }))
              }
            />
          </>
        }
      />
    );
  } else {
    card = (
      <TestResultCard
        kicker="bench.test.dropKicker"
        heading="bench.test.drop"
        report={drop}
        viewer={{ type: "drop", setup: dropSetup, report: drop }}
        controls={
          <>
            <RangeNumberField
              label={t("bench.test.dropHeight")}
              value={dropSetup.heightM}
              min={0.1}
              max={100}
              step={0.1}
              unit="m"
              onChange={(heightM) => setDropSetup((current) => ({ ...current, heightM }))}
            />
            <RangeNumberField
              label={t("bench.test.sampleDiameter")}
              value={dropSetup.diameterMm}
              min={1}
              max={200}
              step={1}
              unit="mm"
              onChange={(diameterMm) =>
                setDropSetup((current) => ({ ...current, diameterMm }))
              }
            />
            <ChoiceGroup<DropFloor>
              label={t("bench.test.floor")}
              value={dropSetup.floor}
              options={[
                { value: "hard", label: t("bench.test.hard") },
                { value: "soft", label: t("bench.test.soft") },
              ]}
              onChange={(floor) => setDropSetup((current) => ({ ...current, floor }))}
            />
          </>
        }
      />
    );
  }

  return (
    <div className="bench-tests">
      <div className="bench-test-picker" role="group" aria-label={t("bench.test.choose")}>
        {TESTS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="button button-secondary"
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {card}
    </div>
  );
}
