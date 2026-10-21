"use client";

import { useEffect, useMemo, useState } from "react";
import { analyze } from "@/lib/formula";
import { jet, type JetInput } from "@/lib/physics";
import { PageIntro, Panel } from "./shared";

type ShooterInput = JetInput;
const defaults: ShooterInput = {
  nozzleMm: 0.5,
  speedMs: 20,
  distanceM: 10,
  viscosityPas: 1,
  densityKgM3: 1100,
  surfaceTensionNm: 0.05,
  nozzleLengthMm: 5,
  solidsFraction: 0.2,
  cartridgeMl: 30,
  cureSeconds: 2,
};
const controls: { key: keyof ShooterInput; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "nozzleMm", label: "Nozzle diameter", unit: "mm", min: 0.05, max: 10, step: 0.05 },
  { key: "speedMs", label: "Exit speed", unit: "m/s", min: 0.1, max: 200, step: 0.5 },
  { key: "distanceM", label: "Target distance", unit: "m", min: 0.1, max: 100, step: 0.5 },
  { key: "viscosityPas", label: "Viscosity", unit: "Pa·s", min: 0.001, max: 100, step: 0.1 },
  { key: "densityKgM3", label: "Density", unit: "kg/m³", min: 1, max: 5000, step: 10 },
  { key: "surfaceTensionNm", label: "Surface tension", unit: "N/m", min: 0.001, max: 1, step: 0.005 },
  { key: "nozzleLengthMm", label: "Nozzle length", unit: "mm", min: 0.1, max: 100, step: 0.5 },
  { key: "cartridgeMl", label: "Cartridge volume", unit: "mL", min: 0.1, max: 1000, step: 1 },
  { key: "solidsFraction", label: "Solids", unit: "%", min: 0, max: 100, step: 1 },
  { key: "cureSeconds", label: "Set time", unit: "s", min: 0, max: 10000, step: 0.5 },
];

function format(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "∞";
}

export default function ShooterTool() {
  const [input, setInput] = useState(defaults);
  const [loadedFormula, setLoadedFormula] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored = JSON.parse(localStorage.getItem("elementlab.current") ?? "null");
        if (stored?.parts) {
          const formula = analyze(stored.parts);
          setInput((current) => ({ ...current, solidsFraction: formula.solidsPct / 100 || 0.2, cureSeconds: formula.cureSeconds || 2 }));
          setLoadedFormula(true);
        }
      } catch {
        setLoadedFormula(false);
      }
    });
    return () => { active = false; };
  }, []);
  const result = useMemo(() => jet(input), [input]);
  const sweep = [5, 10, 20, 40, 80].map((speedMs) => ({ speedMs, result: jet({ ...input, speedMs }) }));
  const setValue = (key: keyof ShooterInput, value: number) => setInput((current) => ({ ...current, [key]: key === "solidsFraction" ? Math.max(0, Math.min(1, value / 100)) : value }));

  return (
    <>
      <PageIntro eyebrow="TOOL 02 / FLUID DYNAMICS" title="Jet shooter" description="Explore how far an idealized fluid jet travels before it sags, breaks up, or sets." />
      <div className="tool-layout">
        <Panel title="Jet parameters" subtitle={loadedFormula ? "Solids and set time loaded from your current formula." : "Solids and set time use the default until a formula is saved in the lab."}>
          <div className="fields-grid">
            {controls.map((control) => <div className="unit-field" key={control.key}><label className="field-label" htmlFor={`jet-${control.key}`}>{control.label}</label><input className="input" id={`jet-${control.key}`} type="number" min={control.min} max={control.max} step={control.step} value={control.key === "solidsFraction" ? input.solidsFraction * 100 : input[control.key]} onChange={(event) => setValue(control.key, Number(event.target.value))} /><span className="unit">{control.unit}</span></div>)}
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Shot estimate" subtitle="A simplified still-air jet and pressure model.">
            <div className="result-tiles">
              <div className="result-tile"><span className="metric-label">FLIGHT TIME</span><strong>{format(result.flightS, 3)} s</strong></div>
              <div className="result-tile"><span className="metric-label">SAG</span><strong>{format(result.dropM, 3)} m</strong></div>
              <div className="result-tile"><span className="metric-label">FLUID / SHOT</span><strong>{format(result.volumeMl, 3)} mL</strong></div>
              <div className="result-tile"><span className="metric-label">SHOTS / CART.</span><strong>{format(result.shots, 0)}</strong></div>
              <div className="result-tile"><span className="metric-label">PRESSURE NEEDED</span><strong>{format(result.pressureBar, 2)} bar</strong></div>
              <div className="result-tile"><span className="metric-label">RECOIL</span><strong>{format(result.recoilN, 3)} N</strong></div>
              <div className="result-tile"><span className="metric-label">DRIED STRAND</span><strong>{format(result.dryDiameterMm, 3)} mm</strong></div>
              <div className="result-tile"><span className="metric-label">BREAKUP LENGTH</span><strong>{format(result.breakupM, 2)} m</strong></div>
            </div>
            <div className="verdict-box">
              <p><strong className={result.staysIntact ? "good" : "warn"}>{result.staysIntact ? "One piece:" : "Likely breaks up:"}</strong> the modeled jet {result.staysIntact ? "stays intact" : "breaks up"} before the target.</p>
              <p><strong className={result.curesInFlight ? "good" : "warn"}>{result.curesInFlight ? "Sets before landing:" : "Still setting at landing:"}</strong> set time {format(input.cureSeconds, 2)} s vs {format(result.flightS, 3)} s flight.</p>
              <p><strong>Minimum speed for &lt;10% sag:</strong> {format(result.minSpeed, 2)} m/s.</p>
              <p><strong>Pressure range:</strong> {result.pressureBar < 5 ? "hand-pump range (&lt;5 bar)" : result.pressureBar < 60 ? "CO₂-cartridge range (&lt;60 bar)" : "beyond this simplified CO₂-cartridge range"}.</p>
            </div>
          </Panel>
          <Panel title="Speed sweep" subtitle="Compare the modeled outcome across five exit speeds.">
            <div className="table-wrap"><table><thead><tr><th>Speed</th><th>Sag</th><th>Intact?</th><th>Pressure</th></tr></thead><tbody>{sweep.map(({ speedMs, result: sample }) => <tr key={speedMs}><td>{speedMs} m/s</td><td>{format(sample.dropM, 3)} m</td><td className={sample.staysIntact ? "good" : "warn"}>{sample.staysIntact ? "Yes" : "No"}</td><td>{format(sample.pressureBar, 2)} bar</td></tr>)}</tbody></table></div>
          </Panel>
          <p className="small muted">This is a physics visualization, not a build guide. Real fluids, wind, nozzle losses, and safety constraints are not captured by these estimates.</p>
        </div>
      </div>
    </>
  );
}
