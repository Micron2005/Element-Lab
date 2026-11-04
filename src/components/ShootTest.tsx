"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtTime } from "@/lib/formula";
import { allBenchIngredients, benchById, localizeBenchIngredient } from "@/lib/bench/library";
import { localizeReactionEvent } from "@/lib/bench/reactions";
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
  tipOutcome,
  twoPartShoot,
  type TwoPartSetup,
} from "@/lib/bench/twoPart";
import type { Experiment, Part, RunResult } from "@/lib/bench/types";
import { useT } from "./LocaleProvider";
import { BENCH_TEST_STATUS_LABEL_KEYS } from "@/lib/bench/displayLabels";
import type { TestSummary } from "@/lib/labReport";
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
  { key: "nozzleMm", label: "bench.test.nozzleDiameter", unit: "mm", min: 0.05, max: 10, step: 0.05 },
  { key: "speedMs", label: "bench.test.exitSpeed", unit: "m/s", min: 0.5, max: 200, step: 0.5 },
  { key: "distanceM", label: "bench.test.targetDistance", unit: "m", min: 0.5, max: 100, step: 0.5 },
  { key: "nozzleLengthMm", label: "bench.test.nozzleLength", unit: "mm", min: 0.5, max: 100, step: 0.5 },
  { key: "cartridgeMl", label: "bench.test.cartridge", unit: "mL", min: 1, max: 1000, step: 1 },
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
  if (value < 0.005) return "bench.test.water";
  if (value < 0.5) return "bench.test.likeSyrup";
  if (value < 50) return "bench.test.likeHoney";
  return "bench.test.likePutty";
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
  onTestSummary,
}: {
  experiment: Experiment;
  result: RunResult;
  onTestSummary?: (summary: TestSummary | null) => void;
}) {
  const { locale, t } = useT();
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
    () => shootTest(experiment, result, setup, locale),
    [experiment, result, setup, locale],
  );
  const twoPartReport = useMemo(
    () => twoPartShoot(experiment, bParts, ratio, setup, locale),
    [experiment, bParts, ratio, setup, locale],
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
  const testSummary = useMemo<TestSummary>(() => {
    const shot = mode === "single" ? singleReport : twoPartReport.shot;
    const ingredientSummary = (parts: Part[]) =>
      parts.map((part) => {
        const ingredient = ingredients.find((item) => item.id === part.id);
        const name = ingredient ? localizeBenchIngredient(ingredient, locale).name : part.id;
        return `${name} ${part.pct}%`;
      }).join(", ") || t("bench.test.none");
    const setupRows: TestSummary["setup"] = [
      [t("bench.test.mode"), mode === "single" ? t("bench.test.oneCartridge") : t("bench.test.twoPart")],
      ...controls.map(({ key, label, unit }) => [
        t(label),
        `${setup[key]} ${unit}`,
      ] as [string, string]),
    ];
    if (mode === "single") {
      setupRows.push([
        t("bench.test.cartridgeAIngredients"),
        ingredientSummary(experiment.parts),
      ]);
    } else {
      setupRows.push(
        [
          t("bench.test.cartridgeAIngredients"),
          ingredientSummary(experiment.parts),
        ],
        [
          t("bench.test.cartridgeBIngredients"),
          ingredientSummary(bParts),
        ],
        [t("bench.test.cartridgeRatio"), `${ratio.ratioA}:${ratio.ratioB}`],
      );
    }
    const metrics = [
      ...(shot?.jet
        ? [
            { label: t("bench.test.pressure"), value: `${formatBar(shot.jet.pressureBar)} bar` },
            { label: t("bench.test.flightTime"), value: `${formatNumber(shot.jet.flightS, 3)} s` },
            { label: t("bench.test.fluidTest"), value: `${formatNumber(shot.jet.volumeMl, 3)} mL` },
          ]
        : []),
      { label: t("bench.test.verdict"), value: shot ? t(BENCH_TEST_STATUS_LABEL_KEYS[shot.verdict]) : t("bench.test.noExtrusionPredicted") },
      { label: t("bench.test.holds"), value: shot?.holdsKg === null || shot?.holdsKg === undefined ? "—" : `${formatNumber(shot.holdsKg, 2)} kg` },
    ];
    return {
      name: t("bench.test.nozzle"),
      setup: setupRows,
      headline: mode === "single" ? singleReport.headline : twoPartReport.headline,
      metrics,
      notes: mode === "single" ? singleReport.notes : twoPartReport.shot?.notes ?? [],
    };
  }, [mode, setup, experiment.parts, bParts, ratio, ingredients, singleReport, twoPartReport, locale, t]);

  useEffect(() => {
    onTestSummary?.(testSummary);
  }, [onTestSummary, testSummary]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(CARTRIDGE_B_STORAGE);
        if (raw !== null) {
          const stored: unknown = JSON.parse(raw);
          if (!isRecord(stored) || !Array.isArray(stored.parts)) {
            throw new Error(t("bench.test.malformedStorage"));
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
  }, [t]);

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
        <span className="bench-kicker">{t("bench.test.nozzleKicker")}</span>
        <h4>{t("bench.test.nozzle")}</h4>
        </div>
        <span className="bench-shoot-label">{t("bench.test.setupOnly")}</span>
      </div>

      <div className="bench-shot-mode" role="group" aria-label={t("bench.test.extrusionMode")}>
        <button
          className="button button-secondary"
          type="button"
          aria-pressed={mode === "single"}
          onClick={() => setMode("single")}
        >
          {t("bench.test.oneCartridge")}
        </button>
        <button
          className="button button-secondary"
          type="button"
          aria-pressed={mode === "two-part"}
          onClick={() => setMode("two-part")}
        >
          {t("bench.test.twoPart")}
        </button>
      </div>

      {mode === "two-part" && (
        <div className="bench-two-part-content">
          <div className="bench-two-part-grid">
            <section className="bench-cartridge-card" aria-label={t("bench.test.cartridgeA")}>
              <h5>{t("bench.test.cartridgeA")}</h5>
              <p>{t("bench.test.yourBenchMix")}</p>
              <ul className="bench-cartridge-parts">
                {experiment.parts.map((part, index) => (
                  <li
                    className="bench-cartridge-summary-row"
                    key={`${part.id}-${index}`}
                  >
                    <span>{benchById[part.id] ? localizeBenchIngredient(benchById[part.id], locale).name : t("bench.ui.deletedIngredient")}</span>
                    <strong>{formatNumber(part.pct, 1)}%</strong>
                  </li>
                ))}
                {experiment.parts.length === 0 && <li>{t("bench.test.noBenchIngredients")}</li>}
              </ul>
              <p
                className={`bench-cartridge-message${twoPartReport.a.issue ? " is-warning" : ""}`}
                role="status"
              >
                {twoPartReport.a.message}
              </p>
            </section>

            <section className="bench-cartridge-card" aria-label={t("bench.test.cartridgeB")}>
              <h5>{t("bench.test.cartridgeB")}</h5>
              <div className="bench-cartridge-add">
                <label className="bench-field">
                  <span className="bench-field-label">{t("bench.test.ingredient")}</span>
                  <select
                    className="select"
                    value={selectedBId}
                    onChange={(event) => setSelectedBId(event.target.value)}
                  >
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {localizeBenchIngredient(ingredient, locale).name}
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
                  {t("bench.test.add")}
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
                {t("bench.test.tryCalciumChloride")}
              </button>
              <ul className="bench-cartridge-parts">
                {bParts.map((part, index) => {
                  const name = benchById[part.id] ? localizeBenchIngredient(benchById[part.id], locale).name : t("bench.ui.deletedIngredient");
                  return (
                    <li className="bench-cartridge-part" key={`${part.id}-${index}`}>
                      <strong>{name}</strong>
                      <RangeNumberField
                        label={t("bench.test.cartridgeBPart", { name })}
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
                        aria-label={t("bench.test.removeFromCartridgeB", { name })}
                        onClick={() =>
                          setBParts((current) =>
                            current.filter((_, partIndex) => partIndex !== index),
                          )
                        }
                      >
                        {t("bench.test.remove")}
                      </button>
                    </li>
                  );
                })}
                {bParts.length === 0 && <li>{t("bench.test.addIngredientsCartridgeB")}</li>}
              </ul>
              <p
                className={`bench-cartridge-message${twoPartReport.b.issue ? " is-warning" : ""}`}
                role="status"
              >
                {twoPartReport.b.message}
              </p>
            </section>
          </div>

          <section className="bench-cartridge-card bench-ratio-card" aria-label={t("bench.test.ratioAria")}>
            <h5>{t("bench.test.ratio")}</h5>
            <div className="bench-shot-controls">
              <RangeNumberField
                label={t("bench.test.aParts")}
                value={ratio.ratioA}
                min={1}
                max={10}
                step={1}
                unit={t("bench.test.partsUnit")}
                onChange={(value) =>
                  setRatio((current) => ({ ...current, ratioA: value }))
                }
              />
              <RangeNumberField
                label={t("bench.test.bParts")}
                value={ratio.ratioB}
                min={1}
                max={10}
                step={1}
                unit={t("bench.test.partsUnit")}
                onChange={(value) =>
                  setRatio((current) => ({ ...current, ratioB: value }))
                }
              />
            </div>
          </section>

          <section className="bench-cartridge-card bench-tip-card" aria-label={t("bench.test.atTip")}>
            <h5>{t("bench.test.atTip")}</h5>
            {twoPartReport.combined ? (
              <>
                <p className="bench-tip-product">
                  {tipOutcome(twoPartReport.combined.result)}
                </p>
                <dl className="bench-tip-metrics">
                  <div>
                    <dt>{t("bench.test.setTime")}</dt>
                    <dd>
                      {twoPartReport.combined.result.setSeconds > 0
                        ? fmtTime(twoPartReport.combined.result.setSeconds)
                        : t("bench.test.doesNotSet")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("bench.test.confidence")}</dt>
                    <dd>
                      {Math.round(twoPartReport.combined.result.confidence * 100)}%
                    </dd>
                  </div>
                </dl>
                <div className="bench-tip-events">
                  <span>{t("bench.test.activeReactions")}</span>
                  {twoPartReport.combined.result.events.filter((event) => event.activity > 0)
                    .length > 0 ? (
                    <ul>
                      {twoPartReport.combined.result.events
                        .filter((event) => event.activity > 0)
                        .map((event) => (
                          <li key={event.id}>
                            {localizeReactionEvent(event, locale).name}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p>{t("bench.test.noActiveReactions")}</p>
                  )}
                </div>
              </>
            ) : (
              <p>{t("bench.test.readyCartridges")}</p>
            )}
          </section>
        </div>
      )}

      <div className="bench-shot-controls">
        {controls.map((control) => (
          <RangeNumberField
            key={control.key}
        label={t(control.label)}
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
              ? t("bench.test.fluidFromMix")
              : t("bench.test.fluidFromCombined")
          }
        >
          <h5>{mode === "single" ? t("bench.test.fromMix") : t("bench.test.combinedMix")}</h5>
          <dl>
            <div>
              <dt>{t("bench.test.density")}</dt>
              <dd>{formatNumber(fluid.densityKgM3, 0)} kg/m³</dd>
            </div>
            <div>
              <dt>{t("bench.test.viscosity")}</dt>
              <dd>
                {fluid.viscosityPas === null
                  ? t("bench.test.noFlowingLiquid")
                  : `${formatViscosity(fluid.viscosityPas)} Pa·s · ${t(viscosityLabel(fluid.viscosityPas))}`}
              </dd>
            </div>
            <div>
              <dt>{t("bench.test.surfaceTension")}</dt>
              <dd>{formatNumber(fluid.surfaceTensionNm, 3)} N/m</dd>
            </div>
            <div>
              <dt>{t("bench.test.solids")}</dt>
              <dd>{formatNumber(fluid.solidsFraction * 100, 1)}%</dd>
            </div>
            <div>
              <dt>{t("bench.test.setTime")}</dt>
              <dd>{fluid.setSeconds > 0 ? fmtTime(fluid.setSeconds, locale) : t("bench.test.doesNotSet")}</dd>
            </div>
          </dl>
        </section>
      ) : mode === "two-part" ? (
        <section className="bench-fluid-summary" aria-label={t("bench.test.fluidFromCombined")}>
          <h5>{t("bench.test.combinedMix")}</h5>
          <p>{t("bench.test.fluidReady")}</p>
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
          <Metric label={t("bench.test.flightTime")} value={`${formatNumber(jetResult.flightS, 3)} s`} />
          <Metric label={t("bench.test.sag")} value={`${formatNumber(jetResult.dropM, 3)} m`} />
          <Metric label={t("bench.test.fluidTest")} value={`${formatNumber(jetResult.volumeMl, 3)} mL`} />
          <Metric
            label={mode === "single" ? t("bench.test.shotsCartridge") : t("bench.test.shotsRefill")}
            value={formatNumber(
              mode === "single"
                ? jetResult.shots
                : twoPartReport.shotsPerCartridge ?? 0,
              0,
            )}
          />
          <Metric
            label={t("bench.test.pressure")}
            value={`${mode === "two-part" ? formatBar(jetResult.pressureBar) : formatNumber(jetResult.pressureBar, 2)} bar`}
          />
          <Metric label={t("bench.test.recoil")} value={`${formatNumber(jetResult.recoilN, 3)} N`} />
          <Metric label={t("bench.test.driedStrand")} value={`${formatNumber(jetResult.dryDiameterMm, 3)} mm`} />
          <Metric
            label={t("bench.test.breakupLength")}
            value={
              jetResult.breakupM > 1000
                ? t("bench.test.staysWhole")
                : `${formatNumber(jetResult.breakupM, 2)} m`
            }
          />
          <Metric
            label={t("bench.test.holds")}
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
