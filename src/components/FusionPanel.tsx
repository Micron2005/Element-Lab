"use client";

import { useMemo, useState } from "react";
import {
  beamForBarrier,
  fmtCrossSection,
  fmtOneIn,
  fuse,
  FUSION_RECIPES,
  measuredHalfLife,
  PROJECTILES,
  type FusionRecipe,
  type Projectile,
} from "@/lib/nuclearFusion";
import { analyzeNucleus, elementName } from "@/lib/nuclear";
import NucleusViewer from "./NucleusViewer";
import { Panel } from "./shared";

const MIN_BEAM_MEV = 0.001;
const MAX_BEAM_MEV = 2000;
const BEAM_RANGE_LOG = Math.log(MAX_BEAM_MEV / MIN_BEAM_MEV);

function projectileFromId(id: string): Projectile {
  return PROJECTILES.find((item) => item.id === id) ?? PROJECTILES[0];
}

function projectileName(projectile: Projectile): string {
  const element = elementName(projectile.z);
  return `${element.name}-${projectile.z + projectile.n} (${element.symbol}-${projectile.z + projectile.n})`;
}

function recipeBeam(recipe: FusionRecipe, projectile: Projectile): number {
  return "labMeV" in recipe.beam
    ? recipe.beam.labMeV
    : beamForBarrier(projectile, recipe.target, recipe.beam.barrierFactor);
}

function particleSummary(emitted: { type: string; count: number }[]): string {
  if (emitted.length === 0) return "None";
  return emitted
    .map(({ type, count }) => {
      const name =
        type === "n"
          ? "n"
          : type === "p"
            ? "p"
            : type === "alpha"
              ? "α"
              : type === "gamma"
                ? "γ"
                : type;
      return `${count}${name}`;
    })
    .join(", ");
}

function formatAtomsPerDay(value: number): string {
  if (value === 0) return "0";
  if (value < 0.01) return value.toExponential(2);
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 }).format(value);
}

function resultTone(dominant: string): "good" | "warn" | "bad" {
  if (dominant === "fuses") return "good";
  if (dominant === "bounce") return "warn";
  return "bad";
}

function displayHalfLife(value: string | undefined, fallback: string): string {
  if (value === "stable") return "Stable (measured)";
  if (value !== undefined) return `${value} (measured)`;
  return fallback;
}

export default function FusionPanel({
  z,
  n,
  onTarget,
  onExplore,
}: {
  z: number;
  n: number;
  onTarget: (z: number, n: number) => void;
  onExplore: (z: number, n: number) => void;
}) {
  const [projectileId, setProjectileId] = useState("ca48");
  const [beamLabMeV, setBeamLabMeV] = useState(260);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const projectile = projectileFromId(projectileId);
  const report = useMemo(
    () => fuse(projectile, { z, n }, beamLabMeV),
    [projectile, z, n, beamLabMeV],
  );
  const activeRecipe = FUSION_RECIPES.find((item) => item.id === activeRecipeId);
  const activeRecipeProjectile = activeRecipe
    ? projectileFromId(activeRecipe.projectileId)
    : undefined;
  const expectedRecipeBeam =
    activeRecipe && activeRecipeProjectile
      ? recipeBeam(activeRecipe, activeRecipeProjectile)
      : undefined;
  const recipeMatches =
    activeRecipe &&
    activeRecipeProjectile &&
    activeRecipe.target.z === z &&
    activeRecipe.target.n === n &&
    activeRecipe.projectileId === projectileId &&
    expectedRecipeBeam !== undefined &&
    Math.abs(expectedRecipeBeam - beamLabMeV) / expectedRecipeBeam <= 1e-3;
  const tone = resultTone(report.dominant);
  const residueName = report.residue.length === 1 ? report.residue[0].name : "";
  const singleResidue = report.residue.length === 1 ? report.residue[0] : undefined;
  const singleResidueMeasuredHalfLife = singleResidue
    ? measuredHalfLife(singleResidue.z, singleResidue.n)
    : undefined;
  const singleResidueHalfLife = singleResidue
    ? displayHalfLife(singleResidueMeasuredHalfLife, report.residueReport?.halfLife ?? "")
    : "";
  const reactionKey = `${z}-${n}-${projectileId}-${beamLabMeV.toPrecision(8)}-${report.reaction}`;
  const beamSliderValue =
    (Math.log(beamLabMeV / MIN_BEAM_MEV) / BEAM_RANGE_LOG) * 1000;

  function chooseRecipe(recipe: FusionRecipe) {
    const nextProjectile = projectileFromId(recipe.projectileId);
    setProjectileId(nextProjectile.id);
    setBeamLabMeV(Number(recipeBeam(recipe, nextProjectile).toPrecision(4)));
    setActiveRecipeId(recipe.id);
    onTarget(recipe.target.z, recipe.target.n);
  }

  function changeBeam(value: number) {
    setBeamLabMeV(Math.max(MIN_BEAM_MEV, Math.min(MAX_BEAM_MEV, value)));
    setActiveRecipeId(null);
  }

  function setJustOverBarrier() {
    changeBeam(Number(beamForBarrier(projectile, { z, n }, 1.03).toPrecision(4)));
  }

  return (
    <Panel
      title="Fusion: smash two nuclei together"
      subtitle="Your nucleus above is the target. Pick what to fire at it."
    >
      <div className="fusion-content">
        <section className="fusion-recipes" aria-labelledby="fusion-recipes-title">
          <h3 id="fusion-recipes-title" className="section-label">
            Real experiments
          </h3>
          <div className="fusion-recipe-list" role="group" aria-label="Real experiments">
            {FUSION_RECIPES.map((recipe) => (
              <button
                key={recipe.id}
                className={`button ${recipe.id === activeRecipeId ? "button-primary" : "button-secondary"}`}
                type="button"
                aria-pressed={recipe.id === activeRecipeId}
                onClick={() => chooseRecipe(recipe)}
              >
                {recipe.label}
              </button>
            ))}
          </div>
          {recipeMatches && (
            <p className="fusion-real-note" role="note">
              {activeRecipe.realNote}
            </p>
          )}
        </section>

        <div className="fusion-controls">
          <div>
            <label className="field-label" htmlFor="fusion-projectile">
              Projectile
            </label>
            <select
              className="select fusion-control"
              id="fusion-projectile"
              value={projectileId}
              onChange={(event) => {
                setProjectileId(event.target.value);
                setActiveRecipeId(null);
              }}
            >
              {PROJECTILES.map((item) => (
                <option key={item.id} value={item.id}>
                  {projectileName(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="fusion-beam-number">
              Beam energy (lab, MeV)
            </label>
            <input
              className="input fusion-control"
              id="fusion-beam-number"
              type="number"
              min={MIN_BEAM_MEV}
              max={MAX_BEAM_MEV}
              step="any"
              value={beamLabMeV}
              onChange={(event) => changeBeam(Number(event.target.value) || MIN_BEAM_MEV)}
            />
          </div>
          <div className="fusion-slider-field">
            <label className="field-label" htmlFor="fusion-beam-slider">
              Beam energy scale: 0.001–2000 MeV
            </label>
            <input
              className="fusion-range"
              id="fusion-beam-slider"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={beamSliderValue}
              onChange={(event) => {
                const fraction = Number(event.target.value) / 1000;
                changeBeam(MIN_BEAM_MEV * Math.exp(BEAM_RANGE_LOG * fraction));
              }}
            />
          </div>
          <button
            className="button button-secondary fusion-control"
            type="button"
            onClick={setJustOverBarrier}
          >
            Just over the barrier
          </button>
        </div>

        <section className={`fusion-result fusion-result-${tone}`} aria-live="polite">
          <p className={`fusion-headline ${tone}`}>{report.headline}</p>
          <p className="fusion-reaction">{report.reaction}</p>
          <div className="fusion-metrics">
            <div className="metric-card">
              <span className="metric-label">Barrier (CM)</span>
              <p className="metric-value">{report.barrierMeV.toFixed(2)} MeV</p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Collision energy (CM)</span>
              <p className="metric-value">{report.ecmMeV.toFixed(2)} MeV</p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Q value</span>
              <p className="metric-value">{report.qMeV.toFixed(2)} MeV</p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Excitation</span>
              <p className="metric-value">{report.excitationMeV.toFixed(2)} MeV</p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Particles off</span>
              <p className="metric-value">{particleSummary(report.emitted)}</p>
            </div>
            <div className="metric-card">
              <span className="metric-label">
                {report.residue.length === 0
                  ? "Energy released"
                  : report.energyReleasedMeV < 0
                    ? "Energy cost"
                    : "Energy released"}
              </span>
              <p className="metric-value">
                {report.residue.length === 0
                  ? "—"
                  : `${Math.abs(report.energyReleasedMeV).toFixed(2)} MeV`}
              </p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Chance per hit</span>
              <p className="metric-value">{fmtOneIn(report.chancePerCollision)}</p>
            </div>
            {report.light ? (
              <div className="metric-card">
                <span className="metric-label">Plasma temperature</span>
                <p className="metric-value">{report.plasmaMillionC?.toFixed(2)} million °C</p>
              </div>
            ) : (
              <>
                <div className="metric-card">
                  <span className="metric-label">Cross-section</span>
                  <p className="metric-value">{fmtCrossSection(report.crossSectionBarn ?? 0)}</p>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Atoms/day</span>
                  <p className="metric-value">{formatAtomsPerDay(report.atomsPerDay ?? 0)}</p>
                </div>
              </>
            )}
          </div>

          <div className="fusion-residue">
            <p className="section-label">{report.residue.length === 1 ? "Residue" : "Products"}</p>
            {report.residue.length === 1 && report.residueReport ? (
              <>
                <div className="fusion-residue-heading">
                  <strong>{report.residue[0].name}</strong>
                  <span className={`badge ${report.residueReport.known ? "badge-good" : "badge-warn"}`}>
                    {report.residueReport.known ? "Known" : "Hypothetical"}
                  </span>
                </div>
                <p className="fusion-half-life">
                  Half-life: {singleResidueHalfLife}
                </p>
                {singleResidueMeasuredHalfLife === undefined ? (
                  <p className={`fusion-verdict ${report.residueReport.bound ? "good" : "bad"}`}>
                    {report.residueReport.verdict}
                  </p>
                ) : (
                  <>
                    {singleResidueMeasuredHalfLife !== "stable" && (
                      <p className="fusion-verdict">Radioactive (measured half-life)</p>
                    )}
                    <span className="badge badge-neutral">Measured</span>
                  </>
                )}
                <button
                  className="button button-secondary fusion-control"
                  type="button"
                  onClick={() => onExplore(report.residue[0].z, report.residue[0].n)}
                >
                  Explore {residueName}
                </button>
              </>
            ) : report.residue.length > 1 ? (
              <div className="fusion-products">
                {report.residue.map((item, index) => {
                  const element = elementName(item.z);
                  const analysis = analyzeNucleus(item.z, item.n);
                  const measured = measuredHalfLife(item.z, item.n);
                  return (
                    <span className="fusion-product" key={`${item.z}-${item.n}-${index}`}>
                      <span className="fusion-product-heading">
                        <strong>{item.name}</strong>
                        <span className={`badge ${element.known ? "badge-good" : "badge-warn"}`}>
                          {element.known ? "Known" : "Hypothetical"}
                        </span>
                      </span>
                      <span className="fusion-half-life">
                        Half-life: {displayHalfLife(measured, analysis.halfLife)}
                      </span>
                      {measured === undefined ? (
                        <span className={`fusion-verdict ${analysis.bound ? "good" : "bad"}`}>
                          {analysis.verdict}
                        </span>
                      ) : (
                        <>
                          {measured !== "stable" && (
                            <span className="fusion-verdict">Radioactive (measured half-life)</span>
                          )}
                          <span className="badge badge-neutral">Measured</span>
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="muted small">No residue forms on this path.</p>
            )}
          </div>

          <ul className="fusion-notes">
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <NucleusViewer key={reactionKey} z={z} n={n} steps={report.steps} />
      </div>
    </Panel>
  );
}
