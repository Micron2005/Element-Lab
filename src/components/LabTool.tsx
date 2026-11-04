"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, cureLabel, fmtTime, hazardWord, PRESETS, waterLabel, type Part } from "@/lib/formula";
import { INGREDIENTS, localizeIngredient, type Ingredient, type Role } from "@/lib/ingredients";
import { strandForLoad } from "@/lib/physics";
import { PageIntro, Panel } from "./shared";
import ShareButton from "./ShareButton";
import ShareNotice from "./ShareNotice";
import { decodeShare, readShareHash } from "@/lib/share";
import { shareUrl } from "@/lib/share";
import { formulaReport } from "@/lib/labReport";
import LabReportButton from "./LabReportButton";
import { useT } from "./LocaleProvider";
import { tr, type MessageKey, type MessageVars } from "@/lib/i18n";

type SavedFormula = { name: string; parts: Part[] };
type LabMessage = { key: MessageKey; vars?: MessageVars };
const STORAGE_CURRENT = "elementlab.current";
const STORAGE_SAVED = "elementlab.saved";
const roles: Role[] = ["polymer", "crosslinker", "adhesive", "plasticizer", "solvent", "filler"];
const ROLE_KEYS: Record<Role, MessageKey> = {
  polymer: "lab.role.polymer",
  crosslinker: "lab.role.crosslinker",
  adhesive: "lab.role.adhesive",
  plasticizer: "lab.role.plasticizer",
  solvent: "lab.role.solvent",
  filler: "lab.role.filler",
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
  const { locale, t } = useT();
  const [parts, setParts] = useState<Part[]>(PRESETS[0].parts);
  const [ready, setReady] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [addId, setAddId] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState<SavedFormula[]>([]);
  const [selectedSave, setSelectedSave] = useState("");
  const [message, setMessage] = useState<LabMessage | null>(null);
  const [shareNotice, setShareNotice] = useState<{ invalid: boolean; dropped: string[] } | null>(null);
  const [shareUndo, setShareUndo] = useState<{ parts: Part[]; selectedPreset: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [loadInputs, setLoadInputs] = useState({ massKg: 70, strands: 1, dynamicFactor: 2, safetyFactor: 3 });
  const result = useMemo(() => analyze(parts, locale), [parts, locale]);
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
        setMessage({ key: "lab.ui.error.restore" });
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

  useEffect(() => {
    if (!ready) return;

    const openShare = () => {
      const encoded = readShareHash(window.location.hash);
      if (encoded === null) return;

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      const decoded = decodeShare(encoded);
      if (!decoded || decoded.payload.kind !== "formula") {
        setShareUndo(null);
        setShareNotice({ invalid: true, dropped: [] });
        return;
      }

      if (parts.length > 0) {
        setShareUndo({
          parts: parts.map((part) => ({ ...part })),
          selectedPreset,
        });
      } else {
        setShareUndo(null);
      }
      setParts(decoded.payload.parts);
      setSelectedPreset("");
      setMessage(null);
      setShareNotice({ invalid: false, dropped: decoded.dropped });
    };

    openShare();
    window.addEventListener("hashchange", openShare);
    return () => window.removeEventListener("hashchange", openShare);
  }, [ready, parts, selectedPreset]);

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
      setMessage({ key: "lab.ui.error.nameRequired" });
      return;
    }
    setSaved((current) => [...current.filter((item) => item.name !== name), { name, parts }]);
    setSelectedSave(name);
    setSaveName("");
    setMessage({ key: "lab.ui.message.saved", vars: { name } });
  };
  const downloadFormula = () => {
    const blob = new Blob([JSON.stringify({ name: tr("en", "lab.ui.exportName"), parts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "science-lab-formula.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importFormula = async (file?: File) => {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const nextParts = safeParts(imported.parts ?? imported);
      if (!nextParts) throw new Error("invalid_parts");
      setParts(nextParts);
      setSelectedPreset("");
      setMessage({ key: "lab.ui.message.imported" });
    } catch {
      setMessage({ key: "lab.ui.error.invalidJson" });
    }
  };
  const loadFormula = () => {
    const formula = saved.find((item) => item.name === selectedSave);
    if (formula) {
      setParts(formula.parts);
      setMessage({ key: "lab.ui.message.loaded", vars: { name: formula.name } });
    }
  };
  const deleteFormula = () => {
    setSaved((current) => current.filter((item) => item.name !== selectedSave));
    setSelectedSave("");
    setMessage({ key: "lab.ui.message.deleted" });
  };
  const load = strandForLoad({ ...loadInputs, tensileMPa: result.tensileMPa });
  const sortedChecks = [...result.checks].sort((a, b) => ({ bad: 0, warn: 1, good: 2 }[a.level] - { bad: 0, warn: 1, good: 2 }[b.level]));

  function undoSharedFormula() {
    if (!shareUndo) return;
    setParts(shareUndo.parts.map((part) => ({ ...part })));
    setSelectedPreset(shareUndo.selectedPreset);
    setShareUndo(null);
    setShareNotice(null);
  }

  return (
    <>
      {shareNotice && (
        <ShareNotice
          invalid={shareNotice.invalid}
          dropped={shareNotice.dropped}
          onUndo={shareUndo ? undoSharedFormula : undefined}
          onDismiss={() => {
            setShareNotice(null);
            setShareUndo(null);
          }}
        />
      )}
      <PageIntro eyebrow={t("lab.ui.eyebrow")} title={t("meta.lab")} description={t("lab.ui.intro")} />
      <div className="lab-layout">
        <div className="stack">
          <Panel title={t("lab.buildMix")} subtitle={t("lab.adjustPercentages")}>
            <div className="preset-row">
              <div><label className="field-label" htmlFor="preset-select">{t("lab.ui.startPreset")}</label><select id="preset-select" className="select" value={selectedPreset} onChange={(event) => {
                const preset = PRESETS[Number(event.target.value)];
                setSelectedPreset(event.target.value);
                if (preset) setParts(preset.parts.map((part) => ({ ...part })));
              }}><option value="">{t("lab.ui.customFormula")}</option>{PRESETS.map((preset, index) => <option value={index} key={preset.name}>{t(preset.nameKey)}</option>)}</select></div>
              <button className="button button-secondary button-small" type="button" onClick={() => setParts((current) => current.map((part) => ({ ...part, pct: total ? part.pct * 100 / total : 0 })))}>{t("lab.ui.normalize")}</button>
              <label className="button button-secondary button-small" htmlFor="import-formula">{t("lab.ui.import")}</label>
            </div>
            <input ref={importRef} id="import-formula" className="file-input" type="file" accept="application/json,.json" onChange={(event) => importFormula(event.target.files?.[0])} />
            {parts.length === 0 && <p className="small muted">{t("lab.emptyMix")}</p>}
            {parts.map((part, index) => {
              const ingredient = INGREDIENTS.find((item) => item.id === part.id) as Ingredient;
              const ingredientName = localizeIngredient(ingredient, locale).name;
              return (
                <div className="ingredient-row" key={`${part.id}-${index}`}>
                  <div className="ingredient-head"><span className="ingredient-name">{ingredientName}</span><span className="badge badge-neutral">{t(ROLE_KEYS[ingredient.role])}</span></div>
                  <div className="ingredient-control">
                    <label className="field-label" htmlFor={`amount-${index}`}><input id={`amount-${index}`} className="input" aria-label={tr(locale, "lab.ui.ingredientPercent", { name: ingredientName })} type="number" min="0" max="100" step="0.5" value={part.pct} onChange={(event) => changePart(index, Number(event.target.value))} /></label>
                    <input aria-label={tr(locale, "lab.ui.ingredientSlider", { name: ingredientName })} type="range" min="0" max="100" step="0.5" value={part.pct} onChange={(event) => changePart(index, Number(event.target.value))} />
                    <button className="icon-button" type="button" aria-label={tr(locale, "lab.ui.removeIngredient", { name: ingredientName })} onClick={() => setParts((current) => current.filter((_, i) => i !== index))}>×</button>
                  </div>
                  <details><summary>{t("bench.ingredient.details")}</summary><p><strong>{t("bench.ingredient.bonding")}</strong> {localizeIngredient(ingredient, locale).bonding}</p><p><strong>{t("bench.ingredient.notes")}</strong> {localizeIngredient(ingredient, locale).notes}</p></details>
                </div>
              );
            })}
            <div className="totals-row"><span className={`total-value ${Math.abs(total - 100) > 0.01 ? "warn" : "good"}`}>{t("lab.ui.total")} {total.toFixed(1)}%</span><span className="small muted">{t("lab.analysisNormalizes")}</span></div>
            <div className="button-row" style={{ marginTop: 13 }}>
              <select className="select" aria-label={t("lab.ui.addIngredient")} value={addId} onChange={(event) => setAddId(event.target.value)} style={{ flex: 1, minWidth: 180 }}>
                <option value="">{t("lab.addIngredient")}</option>
                {roles.map((role) => <optgroup label={t(ROLE_KEYS[role])} key={role}>{INGREDIENTS.filter((item) => item.role === role && !parts.some((part) => part.id === item.id)).map((item) => <option value={item.id} key={item.id}>{localizeIngredient(item, locale).name}</option>)}</optgroup>)}
              </select>
              <button className="button button-primary" type="button" onClick={addIngredient} disabled={!addId}>{t("lab.ui.addIngredient")}</button>
              <ShareButton
                build={() => ({
                  v: 1,
                  kind: "formula",
                  parts: parts.map((part) => ({ ...part })),
                })}
                label={t("lab.ui.share")}
              />
              <LabReportButton
                build={(extra) => {
                  const url = shareUrl(
                    window.location.origin,
                    `${window.location.pathname}${window.location.search}`,
                    { v: 1, kind: "formula", parts: parts.map((part) => ({ ...part })) },
                  );
                  return formulaReport(parts, result, { ...extra, shareUrl: url }, locale);
                }}
              />
            </div>
          </Panel>
          <Panel title={t("lab.ui.save")} subtitle={t("lab.autosave")}>
            <div className="save-grid">
              <div><label className="field-label" htmlFor="save-name">{t("lab.ui.nameFormula")}</label><input className="input" id="save-name" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder={t("lab.ui.namePlaceholder")} /></div>
              <div><label className="field-label" htmlFor="saved-formula">{t("lab.ui.savedFormulas")}</label><select className="select" id="saved-formula" value={selectedSave} onChange={(event) => setSelectedSave(event.target.value)}><option value="">{t("lab.ui.chooseSaved")}</option>{saved.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></div>
              <button className="button button-primary" type="button" onClick={saveFormula}>{t("lab.ui.saveButton")}</button>
            </div>
            <div className="button-row" style={{ marginTop: 10 }}>
              <button className="button button-secondary button-small" type="button" onClick={loadFormula} disabled={!selectedSave}>{t("lab.ui.loadButton")}</button>
              <button className="button button-danger button-small" type="button" onClick={deleteFormula} disabled={!selectedSave}>{t("lab.ui.deleteButton")}</button>
              <button className="button button-secondary button-small" type="button" onClick={downloadFormula}>{t("lab.ui.download")}</button>
            </div>
            {message && <p className="small muted" role="status">{tr(locale, message.key, message.vars)}</p>}
          </Panel>
        </div>
        <div className="stack">
          <Panel title={t("lab.ui.liveEstimate")} subtitle={t("lab.ui.roughModel")}>
            <div className="metric-grid">
              <div className="metric-card"><span className="metric-label">{t("lab.ui.strength")}</span><p className="metric-value">{result.tensileMPa.toFixed(0)} <span className="metric-label">MPa</span></p></div>
              <div className="metric-card"><span className="metric-label">{t("lab.ui.stretch")}</span><p className="metric-value">{result.elongationPct.toFixed(0)} <span className="metric-label">%</span></p></div>
              <div className="metric-card"><span className="metric-label">{t("lab.ui.toughness")}</span><p className="metric-value">{result.toughnessMJm3.toFixed(1)} <span className="metric-label">MJ/m³</span></p></div>
              <div className="metric-card"><span className="metric-label">{t("lab.ui.setTime")}</span><p className="metric-value">{fmtTime(result.cureSeconds, locale)}</p></div>
            </div>
            <div className="stickiness"><span className="metric-label">{t("lab.ui.stickiness")}</span><div className="stick-bar" role="meter" aria-label={t("lab.ui.stickiness")} aria-valuemin={0} aria-valuemax={10} aria-valuenow={result.tack}><span style={{ width: `${Math.max(0, Math.min(100, result.tack * 10))}%` }} /></div><strong className="small">{result.tack.toFixed(1)}/10</strong></div>
            <div className="divider" />
            <p className="section-label">{t("lab.ui.howItSets")}</p>
            <ul className="plain-list">{result.cure.map((mechanism) => <li key={mechanism}><span className="check-icon good">↗</span>{cureLabel(mechanism, locale)}</li>)}</ul>
            <div className="info-grid">
              <div className="info-item"><span className="metric-label">{t("lab.ui.toxicityMixing")}</span><strong className={result.wetToxicity >= 2 ? "bad" : result.wetToxicity === 1 ? "warn" : "good"}>{hazardWord(result.wetToxicity, locale)}</strong></div>
              <div className="info-item"><span className="metric-label">{t("lab.ui.toxicityCured")}</span><strong className={result.curedToxicity >= 2 ? "bad" : result.curedToxicity === 1 ? "warn" : "good"}>{hazardWord(result.curedToxicity, locale)}</strong></div>
              <div className="info-item"><span className="metric-label">{t("lab.ui.skinContact")}</span><strong>{hazardWord(result.skin, locale)}</strong></div>
              <div className="info-item"><span className="metric-label">{t("lab.ui.edible")}</span><strong>{result.edible ? t("report.yes") : t("report.no")}</strong></div>
              <div className="info-item"><span className="metric-label">{t("lab.ui.water")}</span><strong>{waterLabel(result.water, locale)} · {result.dissolveTime}</strong></div>
              <div className="info-item"><span className="metric-label">{t("lab.ui.breakdown")}</span><strong>{result.biodegradable ? t("report.biodegradable") : t("lab.ui.notBiodegradable")}</strong></div>
              <div className="info-item"><span className="metric-label">{t("lab.ui.costEstimate")}</span><strong>${result.costPerKg.toFixed(2)} / kg</strong></div>
              <div className="info-item"><span className="metric-label">{t("lab.ui.solids")}</span><strong>{result.solidsPct.toFixed(1)}%</strong></div>
            </div>
          </Panel>
          <Panel title={t("lab.ui.strengthContext")} subtitle={t("lab.ui.strengthContextNote")}>
            {[[t("lab.ui.spiderSilk"), 1100], [t("lab.ui.steelWire"), 1000], [t("lab.ui.nylonFiber"), 900], ["Kevlar", 3600], [t("lab.ui.humanHair"), 200]].map(([name, value]) => (
              <div className="strength-row" key={name}><span>{name}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, result.tensileMPa / Math.max(3600, Number(value)) * 100)}%`, opacity: Number(value) === 3600 ? 0.6 : 1 }} /></div><span>{value} MPa</span></div>
            ))}
            <p className="small muted" style={{ marginBottom: 0 }}>{t("lab.ui.yourEstimate")} <strong>{result.tensileMPa.toFixed(0)} MPa</strong></p>
          </Panel>
          <Panel title={t("report.checks")}>
            {sortedChecks.length ? <ul className="check-list">{sortedChecks.map((check, index) => <li key={`${check.text}-${index}`}><span className={`check-icon ${check.level}`}>{check.level === "bad" ? "×" : check.level === "warn" ? "!" : "✓"}</span>{check.text}</li>)}</ul> : <p className="small good">{t("lab.ui.noIssues")}</p>}
          </Panel>
          <Panel title={t("lab.ui.whereHow")}>
            <ul className="plain-list">{result.environment.map((line, index) => <li key={index}><span className="check-icon good">›</span>{line}</li>)}</ul>
          </Panel>
          <Panel title={t("lab.ui.loadEstimate")} subtitle={t("lab.ui.loadCaveat")}>
            <div className="load-inputs">
              {([
                [t("lab.ui.bodyMass"), "massKg", "kg", 1, 300],
                [t("lab.ui.strands"), "strands", "count", 1, 100],
                [t("lab.ui.dynamicFactor"), "dynamicFactor", "×", 1, 10],
                [t("lab.ui.safetyFactor"), "safetyFactor", "×", 1, 10],
              ] as const).map(([label, key, unit, min, max]) => <div key={key}><label className="field-label" htmlFor={`load-${key}`}>{label} ({unit === "count" ? t("lab.ui.count") : unit})</label><input className="input" id={`load-${key}`} type="number" min={min} max={max} step={key === "strands" ? 1 : 0.1} value={loadInputs[key]} onChange={(event) => setLoadInputs((current) => ({ ...current, [key]: Math.max(min, Number(event.target.value) || min) }))} /></div>)}
            </div>
            <div className="load-output"><span className="metric-label">{t("lab.ui.requiredDiameter")}</span><strong>{Number.isFinite(load.diameterMm) ? load.diameterMm.toFixed(2) : "∞"} mm</strong><p className="small muted">{t("lab.ui.diameterCompare")}</p></div>
            <Link href="/assistant" className="button button-primary" style={{ marginTop: 13, width: "100%" }}>{t("lab.ui.askAssistant")}</Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
