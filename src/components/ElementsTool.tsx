"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PageIntro, Panel } from "./shared";
import NucleusViewer from "./NucleusViewer";
import FusionPanel from "./FusionPanel";
import QuestBanner from "./QuestBanner";
import { analyzeNucleus, bindingEnergy, stableZ } from "@/lib/nuclear";
import ShareButton from "./ShareButton";
import ShareNotice from "./ShareNotice";
import LabReportButton from "./LabReportButton";
import { nucleusReport } from "@/lib/labReport";
import { PROJECTILES, fuse } from "@/lib/nuclearFusion";
import { decodeShare, readShareHash, shareUrl } from "@/lib/share";
import { Term } from "./Term";
import { useT } from "./LocaleProvider";

function tickStep(range: number, intervals: number) {
  const roughStep = range / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const factor = [1, 2, 2.5, 4, 5, 10].find((candidate) => candidate >= normalized) ?? 10;
  return factor * magnitude;
}

export default function ElementsTool() {
  const { locale, t } = useT();
  const [z, setZ] = useState(120);
  const [n, setN] = useState(184);
  const [projectileId, setProjectileId] = useState("ca48");
  const [beamLabMeV, setBeamLabMeV] = useState(260);
  const [shareNotice, setShareNotice] = useState<{ invalid: boolean; dropped: string[] } | null>(null);
  const [chartWidth, setChartWidth] = useState(760);
  const chartRef = useRef<HTMLDivElement>(null);
  const report = useMemo(() => analyzeNucleus(z, n, locale), [z, n, locale]);

  useEffect(() => {
    const openShare = () => {
      const encoded = readShareHash(window.location.hash);
      if (encoded === null) return;

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      const decoded = decodeShare(encoded);
      if (!decoded || decoded.payload.kind !== "nucleus") {
        setShareNotice({ invalid: true, dropped: [] });
        return;
      }

      const payload = decoded.payload;
      setZ(payload.z);
      setN(payload.n);
      setProjectileId(payload.fusion?.projectileId ?? "ca48");
      setBeamLabMeV(payload.fusion?.beamLabMeV ?? 260);
      setShareNotice({ invalid: false, dropped: decoded.dropped });
    };

    openShare();
    window.addEventListener("hashchange", openShare);
    return () => window.removeEventListener("hashchange", openShare);
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(Math.round(width));
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  const points = useMemo(() => {
    const low = Math.max(0, z - 10);
    const high = 2 * z + 40;
    const samples = Array.from({ length: Math.max(1, high - low + 1) }, (_, index) => low + index)
      .filter((neutrons) => z + neutrons > 0)
      .map((neutrons) => ({ n: neutrons, energy: bindingEnergy(z, neutrons) / (z + neutrons) }));
    const width = Math.max(280, chartWidth);
    const plot = { left: 52, right: width - 18, top: 24, bottom: 208 };
    const minimum = Math.min(...samples.map((point) => point.energy));
    const maximum = Math.max(...samples.map((point) => point.energy));
    const domainMin = minimum - 0.05;
    const domainMax = maximum + 0.05;
    const x = (value: number) => plot.left + ((value - low) / (high - low || 1)) * (plot.right - plot.left);
    const y = (value: number) => plot.bottom - ((value - domainMin) / (domainMax - domainMin)) * (plot.bottom - plot.top);
    const yTicks = Array.from({ length: 5 }, (_, index) => domainMax - ((domainMax - domainMin) * index) / 4);
    const step = tickStep(high - low, 5);
    const xTicks: number[] = [];
    for (let value = Math.ceil(low / step) * step; value <= high; value += step) xTicks.push(value);
    return {
      low,
      high,
      width,
      plot,
      samples,
      x,
      y,
      yTicks,
      xTicks,
      path: samples.map((point) => `${x(point.n)},${y(point.energy)}`).join(" "),
    };
  }, [z, chartWidth]);
  const snapToStable = () => {
    let mass = z + n;
    let neutrons = n;
    for (let index = 0; index < 12; index += 1) {
      neutrons = Math.round(mass - stableZ(mass));
      mass = z + neutrons;
    }
    setN(Math.max(0, Math.min(320, neutrons)));
  };

  return (
    <>
      <PageIntro eyebrow={t("ui.elementsEyebrow")} title={t("elements.title")} description={t("ui.elementsDescription")} />
      <Suspense fallback={null}>
        <QuestBanner mode="atom" z={z} n={n} />
      </Suspense>
      {shareNotice && (
        <ShareNotice
          invalid={shareNotice.invalid}
          dropped={shareNotice.dropped}
          onDismiss={() => setShareNotice(null)}
        />
      )}
      <div className="element-layout">
        <div className="stack">
          <Panel title={t("ui.nucleusControls")} subtitle={t("ui.nucleusRange")}>
            <div className="element-controls">
              {([
                ["elements.control.protons", z, setZ, 1, 200],
                ["elements.control.neutrons", n, setN, 0, 320],
              ] as const).map(([label, value, setter, min, max]) => <div key={label}><label className="field-label" htmlFor={`nucleus-${label}`}>{label === "elements.control.protons" ? <Term id="proton">{t(label)}</Term> : <Term id="neutron">{t(label)}</Term>}</label><div className="dual-slider"><input aria-label={`${t(label)} slider`} type="range" min={min} max={max} value={value} onChange={(event) => setter(Number(event.target.value))} /><input className="input" id={`nucleus-${label}`} type="number" min={min} max={max} value={value} onChange={(event) => setter(Math.max(min, Math.min(max, Number(event.target.value) || min)))} /></div></div>)}
              <div className="element-main-actions">
                <button className="button button-secondary" type="button" onClick={snapToStable}>{t("ui.snapStable")}</button>
                <ShareButton
                  build={() => ({
                    v: 1,
                    kind: "nucleus",
                    z,
                    n,
                    fusion: { projectileId, beamLabMeV },
                  })}
                  label={t("ui.shareNucleus")}
                />
                <LabReportButton
                  build={(extra) => {
                    const projectile = PROJECTILES.find((item) => item.id === projectileId) ?? PROJECTILES[0];
                    const fusion = fuse(projectile, { z, n }, beamLabMeV, locale);
                    const url = shareUrl(
                      window.location.origin,
                      `${window.location.pathname}${window.location.search}`,
                      { v: 1, kind: "nucleus", z, n, fusion: { projectileId, beamLabMeV } },
                    );
                    return nucleusReport(
                      z,
                      n,
                      { report: fusion, projectileLabel: projectile.label, beamLabMeV },
                      { ...extra, shareUrl: url },
                      locale,
                    );
                  }}
                />
              </div>
            </div>
            <p className="small muted" style={{ marginBottom: 0, marginTop: 14 }}>{t("ui.snapDescription")}</p>
          </Panel>
          <Panel title={t("ui.atAGlance")}>
            <div className="element-tile"><div className="element-symbol">{report.symbol}</div><div><h2 className="element-title">{report.name}</h2><p className="small muted" style={{ margin: 0 }}>Z = {report.z} <Term id="proton">{t("ui.protonPlural")}</Term></p><span className={`badge ${report.known ? "badge-good" : "badge-warn"}`} style={{ marginTop: 9 }}>{report.known ? t("ui.knownElement") : t("ui.hypotheticalElement")}</span></div></div>
            <div className="element-facts">
              <div className="fact"><span className="metric-label"><Term id="mass-number">{t("elements.label.massNumber")}</Term> A</span><strong>{report.a}</strong></div>
              <div className="fact"><span className="metric-label"><Term id="binding-energy">{t("elements.label.binding")}</Term> / <Term id="nucleon">{t("elements.label.nucleon")}</Term></span><strong>{report.perNucleonMeV.toFixed(2)} <Term id="mev">MeV</Term></strong></div>
              <div className="fact"><span className="metric-label"><Term id="fissility">{t("elements.label.fissility")}</Term></span><strong>{report.fissility.toFixed(2)}</strong></div>
              <div className="fact"><span className="metric-label"><Term id="half-life">{t("elements.label.estimatedHalfLife")}</Term></span><strong>{report.halfLife}</strong></div>
            </div>
            <p className={`small ${report.bound ? "good" : "bad"}`} style={{ lineHeight: 1.65 }}>{report.verdict}</p>
            <p className="section-label">{t("ui.decayModes")}</p>
            {report.modes.length ? <ul className="plain-list">{report.modes.map((mode) => <li key={mode}><span className="check-icon warn">›</span>{mode.toLowerCase().includes("alpha") ? <Term id="alpha-decay">{mode}</Term> : mode.toLowerCase().includes("beta") ? <Term id="beta-decay">{mode}</Term> : mode}</li>)}</ul> : <p className="small good">{t("ui.noDecay")}</p>}
            <div className="divider" />
            <p className="section-label"><Term id="magic-numbers">{t("elements.label.magicNumbers")}</Term></p>
            <div className="chip-row">{report.magicZ && <span className="badge badge-good"><Term id="magic-numbers">{t("ui.magicNumbers")} Z</Term> · {z}</span>}{report.magicN && <span className="badge badge-good"><Term id="magic-numbers">{t("ui.magicNumbers")} N</Term> · {n}</span>}{!report.magicZ && !report.magicN && <span className="small muted">{t("ui.notMagic")}</span>}</div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title={t("ui.watchHappen")} subtitle={t("ui.nucleusSteps")}>
            <NucleusViewer key={`${z}-${n}`} z={z} n={n} />
          </Panel>
          <FusionPanel
            z={z}
            n={n}
            projectileId={projectileId}
            beamLabMeV={beamLabMeV}
            onProjectileChange={setProjectileId}
            onBeamChange={setBeamLabMeV}
            onTarget={(nextZ, nextN) => {
              setZ(nextZ);
              setN(nextN);
            }}
            onExplore={(nextZ, nextN) => {
              setZ(nextZ);
              setN(nextN);
            }}
          />
          <Panel title={t("ui.bindingCurve")} subtitle={t("ui.bindingCurveDescription", { z })}>
            <div className="chart-wrap" ref={chartRef}>
              <svg viewBox={`0 0 ${points.width} 260`} role="img" aria-label={t("ui.bindingCurveAria", { z, n })}>
                {points.yTicks.map((tick) => <g key={tick}><line x1={points.plot.left} x2={points.plot.right} y1={points.y(tick)} y2={points.y(tick)} stroke="#29383a" strokeWidth="1" /><text x={points.plot.left - 10} y={points.y(tick) + 4} textAnchor="end" fill="#819391" fontSize="12">{tick.toFixed(2)}</text></g>)}
                {points.xTicks.map((tick) => <g key={tick}><line x1={points.x(tick)} x2={points.x(tick)} y1={points.plot.top} y2={points.plot.bottom} stroke="#1c292b" strokeWidth="1" /><text x={points.x(tick)} y={points.plot.bottom + 18} textAnchor="middle" fill="#819391" fontSize="12">{tick}</text></g>)}
                <line x1={points.plot.left} x2={points.plot.right} y1={points.plot.bottom} y2={points.plot.bottom} stroke="#687b79" />
                <line x1={points.plot.left} x2={points.plot.left} y1={points.plot.top} y2={points.plot.bottom} stroke="#687b79" />
                {n >= points.low && n <= points.high && <line x1={points.x(n)} x2={points.x(n)} y1={points.plot.top} y2={points.plot.bottom} stroke="#f0bd69" strokeWidth="1.5" strokeDasharray="6 5" />}
                <polyline points={points.path} fill="none" stroke="#49d5c2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {n >= points.low && n <= points.high && <circle cx={points.x(n)} cy={points.y(report.perNucleonMeV)} r="5" fill="#f0bd69" stroke="#101719" strokeWidth="2"><title>{t("elements.chart.selectedPoint", { n, value: report.perNucleonMeV.toFixed(2) })}</title></circle>}
                <text x={(points.plot.left + points.plot.right) / 2} y="252" textAnchor="middle" fill="#9aacab" fontSize="12">{t("ui.neutronCount")}</text>
                <text x="16" y={(points.plot.top + points.plot.bottom) / 2} textAnchor="middle" fill="#9aacab" fontSize="12" transform={`rotate(-90 16 ${(points.plot.top + points.plot.bottom) / 2})`}>{t("ui.mevPerNucleon")}</text>
              </svg>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>{t("ui.selectedNucleus", { z, n, a: report.a })}</p>
          </Panel>
          <div className="model-note">{t("ui.elementModelNote")}</div>
          <Panel title={t("ui.modelConsider")} subtitle={t("ui.compactEstimate")}>
            <ul className="plain-list"><li><span className="check-icon good">›</span>{t("ui.modelVolume")}</li><li><span className="check-icon good">›</span>{t("ui.modelDrip")}</li><li><span className="check-icon warn">!</span>{t("ui.modelLimitations")}</li></ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
