"use client";

import { FormEvent, useState } from "react";
import { INGREDIENTS, localizeIngredient } from "@/lib/ingredients";
import {
  localizeGhsClassificationNote,
  localizeGhsHazardStatement,
  localizeGhsPictogram,
  localizeGhsSignalWord,
} from "@/lib/ghsSpanish";
import { PageIntro, Panel } from "./shared";
import { useT } from "./LocaleProvider";

type Chemical = {
  cid: number;
  name: string;
  iupacName: string;
  formula: string;
  molecularWeight: string;
  smiles: string;
  xlogp: number | null;
  signalWord: string | null;
  pictograms: string[];
  hazardStatements: string[];
  classificationNotes: string[];
};

const CHEMICAL_API_PATH = "api/chemical";
const quickSearches = [...new Map(INGREDIENTS
  .filter((ingredient) => ingredient.pubchemName)
  .map((ingredient) => [ingredient.pubchemName as string, ingredient])).values()];

export default function ChemicalsTool() {
  const { locale, t } = useT();
  const [query, setQuery] = useState("");
  const [chemical, setChemical] = useState<Chemical | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (value = query) => {
    const term = value.trim();
    if (!term) return;
    setQuery(term);
    setLoading(true);
    setError("");
    setChemical(null);
    try {
      const response = await fetch(`/${CHEMICAL_API_PATH}?q=${encodeURIComponent(term)}`);
      const result = await response.json();
      if (!response.ok) {
        setError(t("chem.lookupFailed"));
        return;
      }
      setChemical(result as Chemical);
    } catch {
      setError(t("chem.lookupFailed"));
    } finally {
      setLoading(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void search();
  };

  return (
    <>
      <PageIntro eyebrow="home.chemicalsLabel" title="ui.chemicalLookup" description="ui.chemicalSearchSubtitle" />
      <div className="stack">
        <Panel title="ui.searchPubChem" subtitle="ui.chemicalSearchSubtitle">
          <form className="search-form" onSubmit={submit}><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("chem.tryNames")} aria-label={t("chem.chemicalName")} /><button className="button button-primary" type="submit" disabled={loading}>{loading ? t("ui.searching") : t("ui.search")}</button></form>
          <p className="section-label" style={{ marginTop: 19 }}>{t("chem.quickIngredientSearch")}</p>
          <div className="chip-row">{quickSearches.map((ingredient) => <button className="chip" type="button" key={ingredient.pubchemName} onClick={() => void search(ingredient.pubchemName!)}>{localizeIngredient(ingredient, locale).name}</button>)}</div>
          {error && <p className="notice" role="alert" style={{ marginTop: 15 }}>{error}</p>}
        </Panel>
        {chemical && (
          <Panel title="chem.compoundRecord" subtitle={t("chem.compoundId", { cid: chemical.cid })}>
            <div className="chemical-layout">
              <div>
                <h2 className="chemical-title">{chemical.name}</h2>
                <p className="small muted">{t("chem.pubchemNamesNote")}</p>
                <a className="text-link" href={`https://pubchem.ncbi.nlm.nih.gov/compound/${chemical.cid}`} target="_blank" rel="noreferrer">{t("chem.openRecord")}</a>
                <dl className="property-list">
                  <dt>{t("ui.iupacName")}</dt><dd>{chemical.iupacName}</dd>
                  <dt>{t("chem.formula")}</dt><dd>{chemical.formula}</dd>
                  <dt>{t("ui.molecularWeight")}</dt><dd>{chemical.molecularWeight} g/mol</dd>
                  <dt>{t("chem.smiles")}</dt><dd>{chemical.smiles}</dd>
                  <dt>XLogP</dt><dd>{chemical.xlogp ?? t("ui.notListed")}</dd>
                </dl>
                <div className="divider" />
                <p className="section-label">{t("ui.ghsHazard")}</p>
                {chemical.signalWord || chemical.pictograms.length || chemical.hazardStatements.length || chemical.classificationNotes.length ? (
                  <>
                    <p className="small">{t("chem.signalWord")} <strong className={chemical.signalWord?.toLowerCase() === "danger" ? "bad" : "warn"}>{localizeGhsSignalWord(chemical.signalWord, locale) ?? t("ui.notListed")}</strong></p>
                    {chemical.pictograms.length > 0 && <p className="small">{t("chem.pictograms")} {chemical.pictograms.map((name) => <span className="badge badge-warn" key={name} style={{ margin: "0 4px 4px" }}>{localizeGhsPictogram(name, locale)}</span>)}</p>}
                    {chemical.hazardStatements.length > 0 && <ul className="hazard-list">{chemical.hazardStatements.map((statement) => <li key={statement}>{localizeGhsHazardStatement(statement, locale)}</li>)}</ul>}
                    {chemical.classificationNotes.map((note) => <p className="small muted" key={note}>{localizeGhsClassificationNote(note, locale)}</p>)}
                  </>
                ) : <p className="small muted">{t("ui.noGhs")}</p>}
              </div>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element -- PubChem returns compound-specific PNG dimensions; render the remote structure directly. */}
                <img className="chemical-image" src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${chemical.cid}/PNG`} alt={t("chem.structureAlt", { name: chemical.name })} />
                <p className="small muted" style={{ textAlign: "center" }}>{t("chem.structure")}</p>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
