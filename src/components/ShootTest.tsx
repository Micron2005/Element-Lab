"use client";

import { useMemo, useState } from "react";
import { fmtTime } from "@/lib/formula";
import {
  DEFAULT_SHOT,
  shootTest,
  type ShotSetup,
} from "@/lib/bench/shootTest";
import type { Experiment, RunResult } from "@/lib/bench/types";
import JetViewer from "./JetViewer";
import RangeNumberField from "./RangeNumberField";

const controls: {
  key: keyof ShotSetup;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "nozzleMm", label: "Nozzle diameter", unit: "mm", min: 0.05, max: 10, step: 0.05 },
  { key: "speedMs", label: "Exit speed", unit: "m/s", min: 0.5, max: 200, step: 0.5 },
  { key: "distanceM", label: "Target distance", unit: "m", min: 0.5, max: 100, step: 0.5 },
  { key: "nozzleLengthMm", label: "Nozzle length", unit: "mm", min: 0.5, max: 100, step: 0.5 },
  { key: "cartridgeMl", label: "Cartridge", unit: "mL", min: 1, max: 1000, step: 1 },
];

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatViscosity(value: number) {
  if (value < 0.01) return Number(value.toPrecision(2)).toString();
  if (value < 10) return value.toFixed(2);
  return formatNumber(value, 1);
}

function viscosityLabel(value: number) {
  if (value < 0.005) return "watery";
  if (value < 0.5) return "like syrup";
  if (value < 50) return "like honey";
  return "like putty";
}

function verdictTone(verdict: ReturnType<typeof shootTest>["verdict"]) {
  if (verdict === "shoots") return "good";
  if (verdict === "unsafe" || verdict === "nothing-to-shoot") return "bad";
  return "warn";
}

export default function ShootTest({
  experiment,
  result,
}: {
  experiment: Experiment;
  result: RunResult;
}) {
  const [setup, setSetup] = useState<ShotSetup>(DEFAULT_SHOT);
  const report = useMemo(
    () => shootTest(experiment, result, setup),
    [experiment, result, setup],
  );
  const { fluid, jet: jetResult } = report;
  const isFiring = report.verdict === "shoots" || report.verdict === "breaks-up";

  function setValue(key: keyof ShotSetup, value: number) {
    setSetup((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="bench-shoot-card">
      <div className="bench-shoot-heading">
        <div>
          <span className="bench-kicker">NOZZLE TEST</span>
          <h4>Shoot it</h4>
        </div>
        <span className="bench-shoot-label">Setup controls only</span>
      </div>

      <div className="bench-shot-controls">
        {controls.map((control) => (
          <RangeNumberField
            key={control.key}
            label={control.label}
            value={setup[control.key]}
            min={control.min}
            max={control.max}
            step={control.step}
            unit={control.unit}
            onChange={(value) => setValue(control.key, value)}
          />
        ))}
      </div>

      <section className="bench-fluid-summary" aria-label="Fluid properties from your mix">
        <h5>From your mix</h5>
        <dl>
          <div>
            <dt>Density</dt>
            <dd>{formatNumber(fluid.densityKgM3, 0)} kg/m³</dd>
          </div>
          <div>
            <dt>Viscosity</dt>
            <dd>
              {fluid.viscosityPas === null
                ? "No flowing liquid"
                : `${formatViscosity(fluid.viscosityPas)} Pa·s · ${viscosityLabel(fluid.viscosityPas)}`}
            </dd>
          </div>
          <div>
            <dt>Surface tension</dt>
            <dd>{formatNumber(fluid.surfaceTensionNm, 3)} N/m</dd>
          </div>
          <div>
            <dt>Solids</dt>
            <dd>{formatNumber(fluid.solidsFraction * 100, 1)}%</dd>
          </div>
          <div>
            <dt>Set time</dt>
            <dd>{fluid.setSeconds > 0 ? fmtTime(fluid.setSeconds) : "Doesn't set on its own"}</dd>
          </div>
        </dl>
      </section>

      <div className={`bench-shot-verdict bench-shot-verdict-${verdictTone(report.verdict)}`} role="status">
        <strong>{report.headline}</strong>
        {report.notes.length > 0 && (
          <ul>
            {report.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
      </div>

      {jetResult && (
        <div className="bench-shot-tiles">
          <Metric label="Flight time" value={`${formatNumber(jetResult.flightS, 3)} s`} />
          <Metric label="Sag" value={`${formatNumber(jetResult.dropM, 3)} m`} />
          <Metric label="Fluid / shot" value={`${formatNumber(jetResult.volumeMl, 3)} mL`} />
          <Metric label="Shots / cartridge" value={formatNumber(jetResult.shots, 0)} />
          <Metric label="Pressure" value={`${formatNumber(jetResult.pressureBar, 2)} bar`} />
          <Metric label="Recoil" value={`${formatNumber(jetResult.recoilN, 3)} N`} />
          <Metric label="Dried strand" value={`${formatNumber(jetResult.dryDiameterMm, 3)} mm`} />
          <Metric label="Breakup length" value={`${formatNumber(jetResult.breakupM, 2)} m`} />
          <Metric
            label="Holds"
            value={report.holdsKg === null ? "—" : `${formatNumber(report.holdsKg, 2)} kg`}
          />
        </div>
      )}

      {isFiring && jetResult ? (
        <JetViewer setup={setup} result={jetResult} setSeconds={fluid.setSeconds} />
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bench-shot-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
