"use client";

import { FormEvent, useState } from "react";
import { INGREDIENTS } from "@/lib/ingredients";
import { PageIntro, Panel } from "./shared";
import { useT } from "./LocaleProvider";
import { trText } from "@/lib/i18n";

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
};

const quickSearches = [...new Map(INGREDIENTS
  .filter((ingredient) => ingredient.pubchemName)
  .map((ingredient) => [ingredient.pubchemName as string, ingredient.name]))];

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
      const response = await fetch(`/api/chemical?q=${encodeURIComponent(term)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Lookup failed.");
      setChemical(result as Chemical);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lookup failed.");
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
      <PageIntro eyebrow="TOOL 03 / REFERENCE DESK" title="Chemical lookup" description="Search PubChem for a compound’s identifiers, computed properties, and available GHS hazard classification." />
      <div className="stack">
        <Panel title="Search PubChem" subtitle="Enter a common or IUPAC name. This lookup is powered by the public PubChem PUG REST API.">
          <form className="search-form" onSubmit={submit}><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("chem.tryNames")} aria-label={t("chem.chemicalName")} /><button className="button button-primary" type="submit" disabled={loading}>{loading ? t("ui.searching") : t("ui.search")}</button></form>
          <p className="section-label" style={{ marginTop: 19 }}>{t("chem.quickIngredientSearch")}</p>
          <div className="chip-row">{quickSearches.map(([name, label]) => <button className="chip" type="button" key={name} onClick={() => void search(name)}>{trText(locale, label)}</button>)}</div>
          {error && <p className="notice" role="alert" style={{ marginTop: 15 }}>{error}</p>}
        </Panel>
        {chemical && (
          <Panel title="Compound record" subtitle={`PubChem compound ID ${chemical.cid}`}>
            <div className="chemical-layout">
              <div>
                <h2 className="chemical-title">{chemical.name}</h2>
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
                {chemical.signalWord || chemical.pictograms.length || chemical.hazardStatements.length ? (
                  <>
                    <p className="small">{t("chem.signalWord")} <strong className={chemical.signalWord?.toLowerCase() === "danger" ? "bad" : "warn"}>{chemical.signalWord ?? t("ui.notListed")}</strong></p>
                    {chemical.pictograms.length > 0 && <p className="small">{t("chem.pictograms")} {chemical.pictograms.map((name) => <span className="badge badge-warn" key={name} style={{ margin: "0 4px 4px" }}>{name}</span>)}</p>}
                    {chemical.hazardStatements.length > 0 && <ul className="hazard-list">{chemical.hazardStatements.map((statement) => <li key={statement}>{statement}</li>)}</ul>}
                  </>
                ) : <p className="small muted">{t("ui.noGhs")}</p>}
              </div>
              <div><img className="chemical-image" src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${chemical.cid}/PNG`} alt={t("chem.structureAlt", { name: chemical.name })} /><p className="small muted" style={{ textAlign: "center" }}>{t("chem.structure")}</p></div>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
