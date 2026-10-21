"use client";

import { useMemo, useState } from "react";
import { PageIntro, Panel } from "./shared";
import { analyzeNucleus, bindingEnergy, stableZ } from "@/lib/nuclear";

export default function ElementsTool() {
  const [z, setZ] = useState(120);
  const [n, setN] = useState(184);
  const report = useMemo(() => analyzeNucleus(z, n), [z, n]);
  const points = useMemo(() => {
    const low = Math.max(0, z - 10);
    const high = 2 * z + 40;
    const samples = Array.from({ length: Math.max(1, high - low + 1) }, (_, index) => low + index)
      .filter((neutrons) => z + neutrons > 0)
      .map((neutrons) => ({ n: neutrons, energy: bindingEnergy(z, neutrons) / (z + neutrons) }));
    const x = (value: number) => 54 + ((value - low) / (high - low || 1)) * 674;
    const y = (value: number) => 190 - (Math.max(0, Math.min(10, value)) / 10) * 164;
    return { low, high, samples, x, y, path: samples.map((point) => `${x(point.n)},${y(point.energy)}`).join(" ") };
  }, [z]);
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
          <Panel title="Binding energy curve" subtitle={`Binding energy per nucleon vs neutron count at Z = ${z}.`}>
            <div className="chart-wrap">
              <svg viewBox="0 0 760 235" role="img" aria-label={`Binding energy per nucleon curve for Z ${z}, with N ${n} marked`}>
                {[0, 2, 4, 6, 8, 10].map((tick) => <g key={tick}><line x1="54" x2="728" y1={points.y(tick)} y2={points.y(tick)} stroke="#29383a" strokeWidth="1" /><text x="44" y={points.y(tick) + 4} textAnchor="end" fill="#819391" fontSize="10">{tick}</text></g>)}
                <line x1="54" x2="728" y1="190" y2="190" stroke="#687b79" />
                <polyline points={points.path} fill="none" stroke="#49d5c2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {n >= points.low && n <= points.high && <circle cx={points.x(n)} cy={points.y(report.perNucleonMeV)} r="5" fill="#f0bd69" stroke="#101719" strokeWidth="2"><title>{`N = ${n}, ${report.perNucleonMeV.toFixed(2)} MeV per nucleon`}</title></circle>}
                <text x="391" y="222" textAnchor="middle" fill="#9aacab" fontSize="11">Neutron count N</text>
                <text x="14" y="105" textAnchor="middle" fill="#9aacab" fontSize="11" transform="rotate(-90 14 105)">MeV per nucleon</text>
                <text x="54" y="207" fill="#819391" fontSize="9">{points.low}</text><text x="728" y="207" textAnchor="end" fill="#819391" fontSize="9">{points.high}</text>
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
