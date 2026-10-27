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
import ShootTest from "./ShootTest";
import RangeNumberField from "./RangeNumberField";
import TestViewer, { type TestViewerData } from "./TestViewer";

type BenchTestId = "shoot" | "stretch" | "heat" | "dissolve" | "stick" | "drop";
const TEST_STORAGE = "elementlab.bench.test";
const TESTS: { id: BenchTestId; label: string }[] = [
  { id: "shoot", label: "Shoot it" },
  { id: "stretch", label: "Stretch" },
  { id: "heat", label: "Heat" },
  { id: "dissolve", label: "Dissolve" },
  { id: "stick", label: "Stick" },
  { id: "drop", label: "Drop" },
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
  return (
    <article className="bench-shoot-card bench-test-card" aria-label={`${heading} test`}>
      <header className="bench-test-card-heading">
        <div>
          <p className="bench-test-kicker">{kicker}</p>
          <h4>{heading}</h4>
        </div>
        <span className="bench-test-setup-label">Setup controls only</span>
      </header>
      <div className="bench-test-controls">{controls}</div>
      <TestViewer key={`${viewer.type}-${JSON.stringify(viewer.setup)}-${report.verdict}`} data={viewer} />
      <div className={`bench-test-verdict tone-${report.tone}`}>
        <strong>{report.verdict.replaceAll("-", " ")}</strong>
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
          <dt>Model confidence</dt>
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
      <p className="bench-test-footnote">Rough model estimate, not a lab measurement.</p>
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
}: {
  experiment: Experiment;
  result: RunResult;
  runId: number;
}) {
  const [selected, setSelected] = useState<BenchTestId>("shoot");
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
    () => stretchTest(experiment, result, stretchSetup),
    [experiment, result, stretchSetup],
  );
  const heat = useMemo(
    () => heatTest(experiment, result, heatSetup),
    [experiment, result, heatSetup],
  );
  const dissolve = useMemo(
    () => dissolveTest(experiment, result, dissolveSetup),
    [experiment, result, dissolveSetup],
  );
  const stick = useMemo(
    () => stickTest(experiment, result, stickSetup),
    [experiment, result, stickSetup],
  );
  const drop = useMemo(
    () => dropTest(experiment, result, dropSetup),
    [experiment, result, dropSetup],
  );

  let card: ReactNode;
  if (selected === "shoot") {
    card = (
      <div className="bench-test-shoot-wrap">
        <ShootTest key={runId} experiment={experiment} result={result} />
        <p className="bench-test-footnote">Rough model estimate, not a lab measurement.</p>
      </div>
    );
  } else if (selected === "stretch") {
    card = (
      <TestResultCard
        kicker="PULL TEST"
        heading="Stretch"
        report={stretch}
        viewer={{ type: "stretch", setup: stretchSetup, report: stretch }}
        controls={
          <>
            <RangeNumberField
              label="Strand diameter"
              value={stretchSetup.diameterMm}
              min={0.05}
              max={20}
              step={0.05}
              unit="mm"
              onChange={(diameterMm) => setStretchSetup((current) => ({ ...current, diameterMm }))}
            />
            <RangeNumberField
              label="Starting length"
              value={stretchSetup.lengthMm}
              min={10}
              max={1000}
              step={1}
              unit="mm"
              onChange={(lengthMm) => setStretchSetup((current) => ({ ...current, lengthMm }))}
            />
            <RangeNumberField
              label="Pull speed"
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
        kicker="HEAT TEST"
        heading="Heat"
        report={heat}
        viewer={{ type: "heat", setup: heatSetup, report: heat }}
        controls={
          <>
            <RangeNumberField
              label="Maximum temperature"
              value={heatSetup.maxTempC}
              min={25}
              max={1000}
              step={1}
              unit="°C"
              onChange={(maxTempC) => setHeatSetup((current) => ({ ...current, maxTempC }))}
            />
            <RangeNumberField
              label="Time at temperature"
              value={heatSetup.minutes}
              min={1}
              max={120}
              step={1}
              unit="min"
              onChange={(minutes) => setHeatSetup((current) => ({ ...current, minutes }))}
            />
            <ChoiceGroup
              label="Atmosphere"
              value={heatSetup.atmosphere}
              options={[
                { value: "air", label: "Air" },
                { value: "nitrogen", label: "Nitrogen" },
              ]}
              onChange={(atmosphere) => setHeatSetup((current) => ({ ...current, atmosphere }))}
            />
          </>
        }
      />
    );
  } else if (selected === "dissolve") {
    const liquids: { value: DissolveLiquid; label: string }[] = [
      { value: "water", label: "Water" },
      { value: "salt-water", label: "Salt water" },
      { value: "acidic", label: "Acidic" },
      { value: "alkaline", label: "Alkaline" },
    ];
    card = (
      <TestResultCard
        kicker="WATER TEST"
        heading="Dissolve"
        report={dissolve}
        viewer={{ type: "dissolve", setup: dissolveSetup, report: dissolve }}
        controls={
          <>
            <ChoiceGroup
              label="Liquid"
              value={dissolveSetup.liquid}
              options={liquids}
              onChange={(liquid) => setDissolveSetup((current) => ({ ...current, liquid }))}
            />
            <RangeNumberField
              label="Liquid temperature"
              value={dissolveSetup.tempC}
              min={0}
              max={100}
              step={1}
              unit="°C"
              onChange={(tempC) => setDissolveSetup((current) => ({ ...current, tempC }))}
            />
            <RangeNumberField
              label="Sample thickness"
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
              {dissolveSetup.stirred ? "Stirred" : "Not stirred"}
            </button>
          </>
        }
      />
    );
  } else if (selected === "stick") {
    const surfaces: { value: StickSurface; label: string }[] = (
      Object.keys(STICK_SURFACE_LABELS) as StickSurface[]
    ).map((value) => ({ value, label: STICK_SURFACE_LABELS[value] }));
    card = (
      <TestResultCard
        kicker="STICK TEST"
        heading="Stick"
        report={stick}
        viewer={{ type: "stick", setup: stickSetup, report: stick }}
        controls={
          <>
            <ChoiceGroup
              label="Surface"
              value={stickSetup.surface}
              options={surfaces}
              onChange={(surface) => setStickSetup((current) => ({ ...current, surface }))}
            />
            <RangeNumberField
              label="Contact area"
              value={stickSetup.areaCm2}
              min={0.1}
              max={100}
              step={0.1}
              unit="cm²"
              onChange={(areaCm2) => setStickSetup((current) => ({ ...current, areaCm2 }))}
            />
            <RangeNumberField
              label="Press time"
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
        kicker="DROP TEST"
        heading="Drop"
        report={drop}
        viewer={{ type: "drop", setup: dropSetup, report: drop }}
        controls={
          <>
            <RangeNumberField
              label="Drop height"
              value={dropSetup.heightM}
              min={0.1}
              max={100}
              step={0.1}
              unit="m"
              onChange={(heightM) => setDropSetup((current) => ({ ...current, heightM }))}
            />
            <RangeNumberField
              label="Sample diameter"
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
              label="Floor"
              value={dropSetup.floor}
              options={[
                { value: "hard", label: "Hard" },
                { value: "soft", label: "Soft" },
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
      <div className="bench-test-picker" role="group" aria-label="Choose a test">
        {TESTS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="button button-secondary"
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {card}
    </div>
  );
}
