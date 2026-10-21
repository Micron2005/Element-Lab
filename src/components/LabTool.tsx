"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, fmtTime, hazardWord, PRESETS, type Part } from "@/lib/formula";
import { INGREDIENTS, type Ingredient, type Role } from "@/lib/ingredients";
import { strandForLoad } from "@/lib/physics";
import { PageIntro, Panel, roleNames } from "./shared";

type SavedFormula = { name: string; parts: Part[] };
const STORAGE_CURRENT = "elementlab.current";
const STORAGE_SAVED = "elementlab.saved";
const roles: Role[] = ["polymer", "crosslinker", "adhesive", "plasticizer", "solvent", "filler"];
const cureNames: Record<string, string> = {
  evaporation: "Solvent evaporates, leaving chains behind",
  "ionic-bath": "Ions bridge chains into a gel",
  moisture: "Humidity triggers a chemical cure",
  anionic: "Trace moisture starts a rapid chain reaction",
  shear: "Flow aligns and locks the molecules",
  cooling: "The melt or gel firms as it cools",
  covalent: "New covalent links join the chains",
  none: "No active setting mechanism",
};

function safeParts(value: unknown): Part[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is Part =>
    Boolean(item) &&
    typeof item === "object" &&
    typeof (item as Part).id === "string" &&
    INGREDIENTS.some((ingredient) => ingredient.id === (item as Part).id) &&
    Number.isFinite((item as Part).pct),
  ).map((part) => ({ id: part.id, pct: Math.min(100, Math.max(0, part.pct)) }));
}

export default function LabTool() {
  const [parts, setParts] = useState<Part[]>(PRESETS[0].parts);
  const [ready, setReady] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [addId, setAddId] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState<SavedFormula[]>([]);
  const [selectedSave, setSelectedSave] = useState("");
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [loadInputs, setLoadInputs] = useState({ massKg: 70, strands: 1, dynamicFactor: 2, safetyFactor: 3 });
  const result = useMemo(() => analyze(parts), [parts]);
  const total = parts.reduce((sum, part) => sum + part.pct, 0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const current = JSON.parse(localStorage.getItem(STORAGE_CURRENT) ?? "null");
        const restored = safeParts(current?.parts ?? current);
        if (restored) setParts(restored);
        const stored = JSON.parse(localStorage.getItem(STORAGE_SAVED) ?? "[]");
        if (Array.isArray(stored)) setSaved(stored.filter((item) => item && typeof item.name === "string" && safeParts(item.parts)).map((item) => ({ name: item.name, parts: safeParts(item.parts) ?? [] })));
      } catch {
        setMessage("Saved data could not be read; starting with the Bio web preset.");
      }
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_CURRENT, JSON.stringify({ parts }));
  }, [parts, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_SAVED, JSON.stringify(saved));
  }, [saved, ready]);

  const changePart = (index: number, pct: number) => {
    setParts((current) => current.map((part, i) => i === index ? { ...part, pct: Math.min(100, Math.max(0, pct)) } : part));
  };
  const addIngredient = () => {
    if (!addId || parts.some((part) => part.id === addId)) return;
    setParts((current) => [...current, { id: addId, pct: 1 }]);
    setAddId("");
  };
  const saveFormula = () => {
    const name = saveName.trim();
    if (!name) {
      setMessage("Give this formula a name before saving.");
      return;
    }
    setSaved((current) => [...current.filter((item) => item.name !== name), { name, parts }]);
    setSelectedSave(name);
    setSaveName("");
    setMessage(`Saved “${name}”.`);
  };
  const downloadFormula = () => {
    const blob = new Blob([JSON.stringify({ name: "Element Lab formula", parts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "element-lab-formula.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importFormula = async (file?: File) => {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const nextParts = safeParts(imported.parts ?? imported);
      if (!nextParts) throw new Error("invalid parts");
      setParts(nextParts);
      setSelectedPreset("");
      setMessage("Formula imported.");
    } catch {
      setMessage("That file does not contain a valid Element Lab formula.");
    }
  };
  const loadFormula = () => {
    const formula = saved.find((item) => item.name === selectedSave);
    if (formula) {
      setParts(formula.parts);
      setMessage(`Loaded “${formula.name}”.`);
    }
  };
  const deleteFormula = () => {
    setSaved((current) => current.filter((item) => item.name !== selectedSave));
    setSelectedSave("");
    setMessage("Saved formula deleted.");
  };
  const load = strandForLoad({ ...loadInputs, tensileMPa: result.tensileMPa });
  const sortedChecks = [...result.checks].sort((a, b) => ({ bad: 0, warn: 1, good: 2 }[a.level] - { bad: 0, warn: 1, good: 2 }[b.level]));

  return (
    <>
      <PageIntro eyebrow="TOOL 01 / MATERIALS DESIGN" title="Formula lab" description="Tune a virtual blend and explore how its ingredients could shape strength, stretch, tack, and set." />
      <div className="lab-layout">
        <div className="stack">
          <Panel title="Build your mix" subtitle="Adjust percentages freely. The model normalizes the composition when it analyzes your formula.">
            <div className="preset-row">
              <div><label className="field-label" htmlFor="preset-select">Start from a preset</label><select id="preset-select" className="select" value={selectedPreset} onChange={(event) => {
                const preset = PRESETS[Number(event.target.value)];
                setSelectedPreset(event.target.value);
                if (preset) setParts(preset.parts.map((part) => ({ ...part })));
              }}><option value="">Custom formula</option>{PRESETS.map((preset, index) => <option value={index} key={preset.name}>{preset.name}</option>)}</select></div>
              <button className="button button-secondary button-small" type="button" onClick={() => setParts((current) => current.map((part) => ({ ...part, pct: total ? part.pct * 100 / total : 0 })))}>Normalize 100%</button>
              <label className="button button-secondary button-small" htmlFor="import-formula">Import .json</label>
            </div>
            <input ref={importRef} id="import-formula" className="file-input" type="file" accept="application/json,.json" onChange={(event) => importFormula(event.target.files?.[0])} />
            {parts.length === 0 && <p className="small muted">Your mix is empty. Add an ingredient to begin.</p>}
            {parts.map((part, index) => {
              const ingredient = INGREDIENTS.find((item) => item.id === part.id) as Ingredient;
              return (
                <div className="ingredient-row" key={`${part.id}-${index}`}>
                  <div className="ingredient-head"><span className="ingredient-name">{ingredient.name}</span><span className="badge badge-neutral">{roleNames[ingredient.role]}</span></div>
                  <div className="ingredient-control">
                    <label className="field-label" htmlFor={`amount-${index}`}><input id={`amount-${index}`} className="input" aria-label={`${ingredient.name} percentage`} type="number" min="0" max="100" step="0.5" value={part.pct} onChange={(event) => changePart(index, Number(event.target.value))} /></label>
                    <input aria-label={`${ingredient.name} slider`} type="range" min="0" max="100" step="0.5" value={part.pct} onChange={(event) => changePart(index, Number(event.target.value))} />
                    <button className="icon-button" type="button" aria-label={`Remove ${ingredient.name}`} onClick={() => setParts((current) => current.filter((_, i) => i !== index))}>×</button>
                  </div>
                  <details><summary>How it bonds / notes</summary><p><strong>Bonding:</strong> {ingredient.bonding}</p><p><strong>Notes:</strong> {ingredient.notes}</p></details>
                </div>
              );
            })}
            <div className="totals-row"><span className={`total-value ${Math.abs(total - 100) > 0.01 ? "warn" : "good"}`}>Total {total.toFixed(1)}%</span><span className="small muted">Analysis normalizes automatically</span></div>
            <div className="button-row" style={{ marginTop: 13 }}>
              <select className="select" aria-label="Add ingredient" value={addId} onChange={(event) => setAddId(event.target.value)} style={{ flex: 1, minWidth: 180 }}>
                <option value="">Add ingredient…</option>
                {roles.map((role) => <optgroup label={roleNames[role]} key={role}>{INGREDIENTS.filter((item) => item.role === role && !parts.some((part) => part.id === item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup>)}
              </select>
              <button className="button button-primary" type="button" onClick={addIngredient} disabled={!addId}>Add ingredient</button>
            </div>
          </Panel>
          <Panel title="Save your work" subtitle="Your active formula is auto-saved in this browser.">
            <div className="save-grid">
              <div><label className="field-label" htmlFor="save-name">Name this formula</label><input className="input" id="save-name" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="e.g. Summer silk blend" /></div>
              <div><label className="field-label" htmlFor="saved-formula">Saved formulas</label><select className="select" id="saved-formula" value={selectedSave} onChange={(event) => setSelectedSave(event.target.value)}><option value="">Choose a saved mix</option>{saved.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></div>
              <button className="button button-primary" type="button" onClick={saveFormula}>Save</button>
            </div>
            <div className="button-row" style={{ marginTop: 10 }}>
              <button className="button button-secondary button-small" type="button" onClick={loadFormula} disabled={!selectedSave}>Load</button>
              <button className="button button-danger button-small" type="button" onClick={deleteFormula} disabled={!selectedSave}>Delete</button>
              <button className="button button-secondary button-small" type="button" onClick={downloadFormula}>Download .json</button>
            </div>
            {message && <p className="small muted" role="status">{message}</p>}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Live material estimate" subtitle="A rough model based on ingredient property ranges.">
            <div className="metric-grid">
              <div className="metric-card"><span className="metric-label">STRENGTH</span><p className="metric-value">{result.tensileMPa.toFixed(0)} <span className="metric-label">MPa</span></p></div>
              <div className="metric-card"><span className="metric-label">STRETCH</span><p className="metric-value">{result.elongationPct.toFixed(0)} <span className="metric-label">%</span></p></div>
              <div className="metric-card"><span className="metric-label">TOUGHNESS</span><p className="metric-value">{result.toughnessMJm3.toFixed(1)} <span className="metric-label">MJ/m³</span></p></div>
              <div className="metric-card"><span className="metric-label">SET TIME</span><p className="metric-value">{fmtTime(result.cureSeconds)}</p></div>
            </div>
            <div className="stickiness"><span className="metric-label">STICKINESS</span><div className="stick-bar" role="meter" aria-label="Stickiness" aria-valuemin={0} aria-valuemax={10} aria-valuenow={result.tack}><span style={{ width: `${Math.max(0, Math.min(100, result.tack * 10))}%` }} /></div><strong className="small">{result.tack.toFixed(1)}/10</strong></div>
            <div className="divider" />
            <p className="section-label">How it sets</p>
            <ul className="plain-list">{result.cure.map((mechanism) => <li key={mechanism}><span className="check-icon good">↗</span>{cureNames[mechanism] ?? mechanism}</li>)}</ul>
            <div className="info-grid">
              <div className="info-item"><span className="metric-label">TOXICITY · MIXING</span><strong className={result.wetToxicity >= 2 ? "bad" : result.wetToxicity === 1 ? "warn" : "good"}>{hazardWord(result.wetToxicity)}</strong></div>
              <div className="info-item"><span className="metric-label">TOXICITY · CURED</span><strong className={result.curedToxicity >= 2 ? "bad" : result.curedToxicity === 1 ? "warn" : "good"}>{hazardWord(result.curedToxicity)}</strong></div>
              <div className="info-item"><span className="metric-label">SKIN CONTACT</span><strong>{hazardWord(result.skin)}</strong></div>
              <div className="info-item"><span className="metric-label">EDIBLE</span><strong>{result.edible ? "Yes" : "No"}</strong></div>
              <div className="info-item"><span className="metric-label">WATER</span><strong>{result.water} · {result.dissolveTime}</strong></div>
              <div className="info-item"><span className="metric-label">BREAKDOWN</span><strong>{result.biodegradable ? "Biodegradable" : "Not biodegradable"}</strong></div>
              <div className="info-item"><span className="metric-label">COST ESTIMATE</span><strong>${result.costPerKg.toFixed(2)} / kg</strong></div>
              <div className="info-item"><span className="metric-label">SOLIDS</span><strong>{result.solidsPct.toFixed(1)}%</strong></div>
            </div>
          </Panel>
          <Panel title="Strength context" subtitle="Reference fibers vary widely; these values are not directly comparable test conditions.">
            {[["Spider dragline", 1100], ["Steel wire", 1000], ["Nylon fiber", 900], ["Kevlar", 3600], ["Human hair", 200]].map(([name, value]) => (
              <div className="strength-row" key={name}><span>{name}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, result.tensileMPa / Math.max(3600, Number(value)) * 100)}%`, opacity: Number(value) === 3600 ? 0.6 : 1 }} /></div><span>{value} MPa</span></div>
            ))}
            <p className="small muted" style={{ marginBottom: 0 }}>Your estimate: <strong>{result.tensileMPa.toFixed(0)} MPa</strong></p>
          </Panel>
          <Panel title="Checks">
            {sortedChecks.length ? <ul className="check-list">{sortedChecks.map((check, index) => <li key={`${check.text}-${index}`}><span className={`check-icon ${check.level}`}>{check.level === "bad" ? "×" : check.level === "warn" ? "!" : "✓"}</span>{check.text}</li>)}</ul> : <p className="small good">No issues flagged by this simplified model.</p>}
          </Panel>
          <Panel title="Where & how to make it">
            <ul className="plain-list">{result.environment.map((line, index) => <li key={index}><span className="check-icon good">›</span>{line}</li>)}</ul>
          </Panel>
          <Panel title="Can it hold me?" subtitle="An idealized load estimate—not a safety guarantee. Never test a person.">
            <div className="load-inputs">
              {([
                ["Body mass", "massKg", "kg", 1, 300],
                ["Strands", "strands", "count", 1, 100],
                ["Swing factor", "dynamicFactor", "×", 1, 10],
                ["Safety factor", "safetyFactor", "×", 1, 10],
              ] as const).map(([label, key, unit, min, max]) => <div key={key}><label className="field-label" htmlFor={`load-${key}`}>{label} ({unit})</label><input className="input" id={`load-${key}`} type="number" min={min} max={max} step={key === "strands" ? 1 : 0.1} value={loadInputs[key]} onChange={(event) => setLoadInputs((current) => ({ ...current, [key]: Math.max(min, Number(event.target.value) || min) }))} /></div>)}
            </div>
            <div className="load-output"><span className="metric-label">REQUIRED STRAND DIAMETER</span><strong>{Number.isFinite(load.diameterMm) ? load.diameterMm.toFixed(2) : "∞"} mm</strong><p className="small muted">Human hair ≈ 0.07 mm · spaghetti ≈ 1.8 mm</p></div>
            <Link href="/assistant" className="button button-primary" style={{ marginTop: 13, width: "100%" }}>Ask the assistant about this mix ↗</Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
