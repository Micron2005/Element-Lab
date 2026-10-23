"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtTime } from "@/lib/formula";
import { allBenchIngredients, benchById } from "@/lib/bench/library";
import {
  DEFAULT_SHOT,
  fluidFromMix,
  formatBar,
  shootTest,
  type ShotSetup,
} from "@/lib/bench/shootTest";
import {
  CARTRIDGE_B_STORAGE,
  DEFAULT_RATIO,
  parseStoredCartridgeB,
  twoPartShoot,
  type TwoPartSetup,
} from "@/lib/bench/twoPart";
import type { Experiment, Part, RunResult } from "@/lib/bench/types";
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

type ShotMode = "single" | "two-part";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRatio(value: unknown): value is TwoPartSetup {
  return (
    isRecord(value) &&
    Number.isInteger(value.ratioA) &&
    Number.isInteger(value.ratioB) &&
    (value.ratioA as number) >= 1 &&
    (value.ratioA as number) <= 10 &&
    (value.ratioB as number) >= 1 &&
    (value.ratioB as number) <= 10
  );
}

export default function ShootTest({
  experiment,
  result,
}: {
  experiment: Experiment;
  result: RunResult;
}) {
  const [setup, setSetup] = useState<ShotSetup>(DEFAULT_SHOT);
  const [mode, setMode] = useState<ShotMode>("single");
  const [ratio, setRatio] = useState<TwoPartSetup>(DEFAULT_RATIO);
  const [bParts, setBParts] = useState<Part[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedBId, setSelectedBId] = useState(
    () => allBenchIngredients()[0]?.id ?? "",
  );
  const ingredients = allBenchIngredients();
  const singleReport = useMemo(
    () => shootTest(experiment, result, setup),
    [experiment, result, setup],
  );
  const twoPartReport = useMemo(
    () => twoPartShoot(experiment, bParts, ratio, setup),
    [experiment, bParts, ratio, setup],
  );
  const combinedFluid = useMemo(
    () =>
      twoPartReport.combined
        ? fluidFromMix(
            twoPartReport.combined.experiment,
            twoPartReport.combined.result,
          )
        : null,
    [twoPartReport.combined],
  );
  const fluid = mode === "single" ? singleReport.fluid : combinedFluid;
  const jetResult =
    mode === "single" ? singleReport.jet : twoPartReport.shot?.jet ?? null;
  const verdict =
    mode === "single" ? singleReport.verdict : twoPartReport.shot?.verdict;
  const holdsKg =
    mode === "single" ? singleReport.holdsKg : twoPartReport.shot?.holdsKg ?? null;
  const isFiring =
    (verdict === "shoots" ||
      verdict === "breaks-up" ||
      verdict === "falls-short") &&
    jetResult !== null;
  const twoPartTone =
    twoPartReport.a.issue === "unsafe" || twoPartReport.b.issue === "unsafe"
      ? "bad"
      : twoPartReport.a.issue ||
          twoPartReport.b.issue ||
          twoPartReport.clogsNozzle
        ? "warn"
        : twoPartReport.shot
          ? verdictTone(twoPartReport.shot.verdict)
          : "warn";
  const twoPartHeadlinePrefix = twoPartReport.shot
    ? twoPartReport.headline
        .slice(0, -twoPartReport.shot.headline.length)
        .trim()
    : null;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(CARTRIDGE_B_STORAGE);
        if (raw !== null) {
          const stored: unknown = JSON.parse(raw);
          if (!isRecord(stored) || !Array.isArray(stored.parts)) {
            throw new Error("Malformed cartridge storage");
          }
          if (stored.mode === "single" || stored.mode === "two-part") {
            setMode(stored.mode);
          }
          if (isValidRatio(stored.ratio)) setRatio(stored.ratio);
          setBParts(parseStoredCartridgeB(stored.parts));
        }
      } catch {
        try {
          localStorage.removeItem(CARTRIDGE_B_STORAGE);
        } catch {
          // Storage can be unavailable in restricted browser contexts.
        }
      }
      setStorageReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(
        CARTRIDGE_B_STORAGE,
        JSON.stringify({ mode, ratio, parts: bParts }),
      );
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, [bParts, mode, ratio, storageReady]);

  function setValue(key: keyof ShotSetup, value: number) {
    setSetup((current) => ({ ...current, [key]: value }));
  }

  function addBIngredient() {
    if (!selectedBId || bParts.some((part) => part.id === selectedBId)) return;
    setBParts((current) => [...current, { id: selectedBId, pct: 1 }]);
  }

  function setBPartPct(index: number, pct: number) {
    setBParts((current) =>
      current.map((part, partIndex) =>
        partIndex === index ? { ...part, pct } : part,
      ),
    );
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

      <div className="bench-shot-mode" role="group" aria-label="Shot mode">
        <button
          className="button button-secondary"
          type="button"
          aria-pressed={mode === "single"}
          onClick={() => setMode("single")}
        >
          One cartridge
        </button>
        <button
          className="button button-secondary"
          type="button"
          aria-pressed={mode === "two-part"}
          onClick={() => setMode("two-part")}
        >
          Two-part (A + B)
        </button>
      </div>

      {mode === "two-part" && (
        <div className="bench-two-part-content">
          <div className="bench-two-part-grid">
            <section className="bench-cartridge-card" aria-label="Cartridge A">
              <h5>Cartridge A</h5>
              <p>Your Bench mix</p>
              <ul className="bench-cartridge-parts">
                {experiment.parts.map((part, index) => (
                  <li key={`${part.id}-${index}`}>
                    <span>{benchById[part.id]?.name ?? "Deleted ingredient"}</span>
                    <strong>{formatNumber(part.pct, 1)}%</strong>
                  </li>
                ))}
                {experiment.parts.length === 0 && <li>No ingredients in the Bench mix.</li>}
              </ul>
              <p
                className={`bench-cartridge-message${twoPartReport.a.issue ? " is-warning" : ""}`}
                role="status"
              >
                {twoPartReport.a.message}
              </p>
            </section>

            <section className="bench-cartridge-card" aria-label="Cartridge B">
              <h5>Cartridge B</h5>
              <div className="bench-cartridge-add">
                <label className="bench-field">
                  <span className="bench-field-label">Ingredient</span>
                  <select
                    className="select"
                    value={selectedBId}
                    onChange={(event) => setSelectedBId(event.target.value)}
                  >
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!selectedBId || bParts.some((part) => part.id === selectedBId)}
                  onClick={addBIngredient}
                >
                  Add
                </button>
              </div>
              <button
                className="button button-secondary bench-two-part-example"
                type="button"
                onClick={() =>
                  setBParts([
                    { id: "cacl2", pct: 5 },
                    { id: "water", pct: 95 },
                  ])
                }
              >
                Try an example: calcium chloride solution
              </button>
              <ul className="bench-cartridge-parts">
                {bParts.map((part, index) => {
                  const name = benchById[part.id]?.name ?? "Deleted ingredient";
                  return (
                    <li className="bench-cartridge-part" key={`${part.id}-${index}`}>
                      <strong>{name}</strong>
                      <RangeNumberField
                        label={`${name} in cartridge B`}
                        value={part.pct}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(value) => setBPartPct(index, value)}
                      />
                      <button
                        className="button button-secondary"
                        type="button"
                        aria-label={`Remove ${name} from cartridge B`}
                        onClick={() =>
                          setBParts((current) =>
                            current.filter((_, partIndex) => partIndex !== index),
                          )
                        }
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
                {bParts.length === 0 && <li>Add ingredients to cartridge B.</li>}
              </ul>
              <p
                className={`bench-cartridge-message${twoPartReport.b.issue ? " is-warning" : ""}`}
                role="status"
              >
                {twoPartReport.b.message}
              </p>
            </section>
          </div>

          <section className="bench-cartridge-card bench-ratio-card" aria-label="Cartridge ratio">
            <h5>Ratio</h5>
            <div className="bench-shot-controls">
              <RangeNumberField
                label="A parts"
                value={ratio.ratioA}
                min={1}
                max={10}
                step={1}
                unit="parts"
                onChange={(value) =>
                  setRatio((current) => ({ ...current, ratioA: value }))
                }
              />
              <RangeNumberField
                label="B parts"
                value={ratio.ratioB}
                min={1}
                max={10}
                step={1}
                unit="parts"
                onChange={(value) =>
                  setRatio((current) => ({ ...current, ratioB: value }))
                }
              />
            </div>
          </section>

          <section className="bench-cartridge-card bench-tip-card" aria-label="At the tip">
            <h5>At the tip</h5>
            {twoPartReport.combined ? (
              <>
                <p className="bench-tip-product">
                  {twoPartReport.combined.result.productLabel}
                </p>
                <dl className="bench-tip-metrics">
                  <div>
                    <dt>Set time</dt>
                    <dd>
                      {twoPartReport.combined.result.setSeconds > 0
                        ? fmtTime(twoPartReport.combined.result.setSeconds)
                        : "Doesn't set on its own"}
                    </dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>
                      {Math.round(twoPartReport.combined.result.confidence * 100)}%
                    </dd>
                  </div>
                </dl>
                <div className="bench-tip-events">
                  <span>Active reactions</span>
                  {twoPartReport.combined.result.events.filter((event) => event.activity > 0)
                    .length > 0 ? (
                    <ul>
                      {twoPartReport.combined.result.events
                        .filter((event) => event.activity > 0)
                        .map((event) => <li key={event.id}>{event.name}</li>)}
                    </ul>
                  ) : (
                    <p>No active modeled reactions.</p>
                  )}
                </div>
              </>
            ) : (
              <p>Combine A and B at the tip when both cartridges are ready.</p>
            )}
          </section>
        </div>
      )}

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

      {fluid ? (
        <section
          className="bench-fluid-summary"
          aria-label={
            mode === "single"
              ? "Fluid properties from your mix"
              : "Fluid properties from the combined mix"
          }
        >
          <h5>{mode === "single" ? "From your mix" : "Combined mix"}</h5>
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
      ) : mode === "two-part" ? (
        <section className="bench-fluid-summary" aria-label="Combined fluid properties">
          <h5>Combined mix</h5>
          <p>Fluid properties appear when both cartridges are ready.</p>
        </section>
      ) : null}

      {mode === "two-part" && twoPartHeadlinePrefix && (
        <div className="bench-two-part-headline" role="status">
          <strong>{twoPartHeadlinePrefix}</strong>
        </div>
      )}
      <div
        className={`bench-shot-verdict bench-shot-verdict-${mode === "single" ? verdictTone(singleReport.verdict) : twoPartTone}`}
        role="status"
      >
        <strong>
          {mode === "single"
            ? singleReport.headline
            : twoPartReport.shot?.headline ?? twoPartReport.headline}
        </strong>
        {(mode === "single" ? singleReport.notes : twoPartReport.shot?.notes ?? []).length >
          0 && (
          <ul>
            {(mode === "single" ? singleReport.notes : twoPartReport.shot?.notes ?? []).map(
              (note) => <li key={note}>{note}</li>,
            )}
          </ul>
        )}
      </div>

      {isFiring && jetResult && (
        <div className="bench-shot-tiles">
          <Metric label="Flight time" value={`${formatNumber(jetResult.flightS, 3)} s`} />
          <Metric label="Sag" value={`${formatNumber(jetResult.dropM, 3)} m`} />
          <Metric label="Fluid / shot" value={`${formatNumber(jetResult.volumeMl, 3)} mL`} />
          <Metric
            label={mode === "single" ? "Shots / cartridge" : "Shots per refill"}
            value={formatNumber(
              mode === "single"
                ? jetResult.shots
                : twoPartReport.shotsPerCartridge ?? 0,
              0,
            )}
          />
          <Metric
            label="Pressure"
            value={`${mode === "two-part" ? formatBar(jetResult.pressureBar) : formatNumber(jetResult.pressureBar, 2)} bar`}
          />
          <Metric label="Recoil" value={`${formatNumber(jetResult.recoilN, 3)} N`} />
          <Metric label="Dried strand" value={`${formatNumber(jetResult.dryDiameterMm, 3)} mm`} />
          <Metric
            label="Breakup length"
            value={
              jetResult.breakupM > 1000
                ? "> 1 km (stays whole)"
                : `${formatNumber(jetResult.breakupM, 2)} m`
            }
          />
          <Metric
            label="Holds"
            value={holdsKg === null ? "—" : `${formatNumber(holdsKg, 2)} kg`}
          />
        </div>
      )}

      {isFiring && jetResult ? (
        <JetViewer
          setup={setup}
          result={jetResult}
          setSeconds={fluid?.setSeconds ?? 0}
          twoPart={mode === "two-part" ? ratio : undefined}
        />
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
