"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PageIntro, Panel } from "./shared";
import NucleusViewer from "./NucleusViewer";
import QuestBanner from "./QuestBanner";
import { analyzeNucleus, bindingEnergy, stableZ } from "@/lib/nuclear";

function tickStep(range: number, intervals: number) {
  const roughStep = range / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const factor = [1, 2, 2.5, 4, 5, 10].find((candidate) => candidate >= normalized) ?? 10;
  return factor * magnitude;
}

export default function ElementsTool() {
  const [z, setZ] = useState(120);
  const [n, setN] = useState(184);
  const [chartWidth, setChartWidth] = useState(760);
  const chartRef = useRef<HTMLDivElement>(null);
  const report = useMemo(() => analyzeNucleus(z, n), [z, n]);
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
      <PageIntro eyebrow="TOOL 04 / NUCLEAR PHYSICS" title="Element explorer" description="Change the proton and neutron count to explore what a liquid-drop model predicts for a nucleus." />
      <Suspense fallback={null}>
        <QuestBanner mode="atom" z={z} n={n} />
      </Suspense>
      <div className="element-layout">
        <div className="stack">
          <Panel title="Nucleus controls" subtitle="Explore Z from 1–200 and N from 0–320.">
            <div className="element-controls">
              {([
                ["Protons (Z)", z, setZ, 1, 200],
                ["Neutrons (N)", n, setN, 0, 320],
              ] as const).map(([label, value, setter, min, max]) => <div key={label}><label className="field-label" htmlFor={`nucleus-${label}`}>{label}</label><div className="dual-slider"><input aria-label={`${label} slider`} type="range" min={min} max={max} value={value} onChange={(event) => setter(Number(event.target.value))} /><input className="input" id={`nucleus-${label}`} type="number" min={min} max={max} value={value} onChange={(event) => setter(Math.max(min, Math.min(max, Number(event.target.value) || min)))} /></div></div>)}
              <button className="button button-secondary" type="button" onClick={snapToStable}>Snap N to most stable</button>
            </div>
            <p className="small muted" style={{ marginBottom: 0, marginTop: 14 }}>Snap iterates the beta-stability estimate from the selected proton count.</p>
          </Panel>
          <Panel title="At a glance">
            <div className="element-tile"><div className="element-symbol">{report.symbol}</div><div><h2 className="element-title">{report.name}</h2><p className="small muted" style={{ margin: 0 }}>Z = {report.z} protons</p><span className={`badge ${report.known ? "badge-good" : "badge-warn"}`} style={{ marginTop: 9 }}>{report.known ? "Known element" : "Hypothetical · systematic IUPAC name"}</span></div></div>
            <div className="element-facts">
              <div className="fact"><span className="metric-label">MASS NUMBER A</span><strong>{report.a}</strong></div>
              <div className="fact"><span className="metric-label">BINDING / NUCLEON</span><strong>{report.perNucleonMeV.toFixed(2)} MeV</strong></div>
              <div className="fact"><span className="metric-label">FISSILITY</span><strong>{report.fissility.toFixed(2)}</strong></div>
              <div className="fact"><span className="metric-label">EST. HALF-LIFE</span><strong>{report.halfLife}</strong></div>
            </div>
            <p className={`small ${report.bound ? "good" : "bad"}`} style={{ lineHeight: 1.65 }}>{report.verdict}</p>
            <p className="section-label">Decay modes</p>
            {report.modes.length ? <ul className="plain-list">{report.modes.map((mode) => <li key={mode}><span className="check-icon warn">›</span>{mode}</li>)}</ul> : <p className="small good">No decay modes predicted by this model.</p>}
            <div className="divider" />
            <p className="section-label">Magic numbers</p>
            <div className="chip-row">{report.magicZ && <span className="badge badge-good">Magic Z · {z}</span>}{report.magicN && <span className="badge badge-good">Magic N · {n}</span>}{!report.magicZ && !report.magicN && <span className="small muted">Neither count is a listed magic number.</span>}</div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Watch it happen" subtitle="See what the model predicts this nucleus does, step by step.">
            <NucleusViewer key={`${z}-${n}`} z={z} n={n} />
          </Panel>
          <Panel title="Binding energy curve" subtitle={`Binding energy per nucleon vs neutron count at Z = ${z}.`}>
            <div className="chart-wrap" ref={chartRef}>
              <svg viewBox={`0 0 ${points.width} 260`} role="img" aria-label={`Binding energy per nucleon curve for Z ${z}, with N ${n} marked`}>
                {points.yTicks.map((tick) => <g key={tick}><line x1={points.plot.left} x2={points.plot.right} y1={points.y(tick)} y2={points.y(tick)} stroke="#29383a" strokeWidth="1" /><text x={points.plot.left - 10} y={points.y(tick) + 4} textAnchor="end" fill="#819391" fontSize="12">{tick.toFixed(2)}</text></g>)}
                {points.xTicks.map((tick) => <g key={tick}><line x1={points.x(tick)} x2={points.x(tick)} y1={points.plot.top} y2={points.plot.bottom} stroke="#1c292b" strokeWidth="1" /><text x={points.x(tick)} y={points.plot.bottom + 18} textAnchor="middle" fill="#819391" fontSize="12">{tick}</text></g>)}
                <line x1={points.plot.left} x2={points.plot.right} y1={points.plot.bottom} y2={points.plot.bottom} stroke="#687b79" />
                <line x1={points.plot.left} x2={points.plot.left} y1={points.plot.top} y2={points.plot.bottom} stroke="#687b79" />
                {n >= points.low && n <= points.high && <line x1={points.x(n)} x2={points.x(n)} y1={points.plot.top} y2={points.plot.bottom} stroke="#f0bd69" strokeWidth="1.5" strokeDasharray="6 5" />}
                <polyline points={points.path} fill="none" stroke="#49d5c2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {n >= points.low && n <= points.high && <circle cx={points.x(n)} cy={points.y(report.perNucleonMeV)} r="5" fill="#f0bd69" stroke="#101719" strokeWidth="2"><title>{`N = ${n}, ${report.perNucleonMeV.toFixed(2)} MeV per nucleon`}</title></circle>}
                <text x={(points.plot.left + points.plot.right) / 2} y="252" textAnchor="middle" fill="#9aacab" fontSize="12">Neutron count N</text>
                <text x="16" y={(points.plot.top + points.plot.bottom) / 2} textAnchor="middle" fill="#9aacab" fontSize="12" transform={`rotate(-90 16 ${(points.plot.top + points.plot.bottom) / 2})`}>MeV per nucleon</text>
              </svg>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>Selected nucleus: Z = {z}, N = {n}, A = {report.a}.</p>
          </Panel>
          <div className="model-note">Real new elements are made by smashing nuclei together in particle accelerators, a few atoms at a time. This liquid-drop model ignores shell effects, so half-lives are rough (often off by orders of magnitude).</div>
          <Panel title="What the model considers" subtitle="A compact nuclear estimate, not a map of confirmed isotopes.">
            <ul className="plain-list"><li><span className="check-icon good">›</span>Volume, surface, Coulomb, asymmetry, and pairing contributions.</li><li><span className="check-icon good">›</span>Neutron/proton drip conditions and estimated alpha, beta, and fission modes.</li><li><span className="check-icon warn">!</span>Shell corrections, real isotope measurements, and experimental uncertainties are not included.</li></ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
