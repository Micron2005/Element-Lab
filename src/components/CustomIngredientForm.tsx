"use client";

import { useState, type FormEvent } from "react";
import {
  draftFromIngredient,
  emptyDraft,
  newCustomId,
  validateCustomDraft,
} from "@/lib/bench/custom";
import { hazardWord } from "@/lib/formula";
import type { CustomDraft, CustomTrait } from "@/lib/bench/custom";
import type { BenchIngredient, Category, Hazard, WaterBehavior } from "@/lib/bench/types";

interface CustomIngredientFormProps {
  initial?: BenchIngredient;
  onSave(ingredient: BenchIngredient): void;
  onCancel(): void;
  onDelete?(): void;
}

const categoryOptions: { value: Category; label: string }[] = [
  { value: "element", label: "Element" },
  { value: "salt", label: "Salt" },
  { value: "protein", label: "Protein" },
  { value: "enzyme", label: "Enzyme" },
  { value: "polymer", label: "Polymer" },
  { value: "solvent", label: "Solvent" },
  { value: "acid-base", label: "Acid or base" },
  { value: "additive", label: "Additive" },
  { value: "filler", label: "Filler" },
];

type StringField =
  | "name"
  | "formula"
  | "tensileMPa"
  | "elongationPct"
  | "tack"
  | "density"
  | "viscosityPas"
  | "boilC"
  | "pKa"
  | "molarMass"
  | "costPerKg"
  | "notes";

const traitOptions: { value: CustomTrait; label: string }[] = [
  { value: "protein", label: "Protein: enzymes can link or digest it" },
  { value: "diol", label: "Sugar-like OH groups: borax can link it (polymers)" },
  { value: "elastomer", label: "Rubbery: stays stretchy when linked" },
];

function errorId(field: keyof CustomDraft): string {
  return `custom-ingredient-${field}-error`;
}

export default function CustomIngredientForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: CustomIngredientFormProps) {
  const [draft, setDraft] = useState<CustomDraft>(() =>
    initial ? draftFromIngredient(initial) : emptyDraft(),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof CustomDraft, string>>>({});

  function update<K extends keyof CustomDraft>(field: K, value: CustomDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function renderStringField(
    field: StringField,
    label: string,
    options: { numeric?: boolean; hint?: string; textarea?: boolean } = {},
  ) {
    const fieldError = errors[field];
    const hintId = options.hint ? `custom-ingredient-${field}-hint` : undefined;
    const describedBy = [
      hintId,
      fieldError ? errorId(field) : undefined,
    ].filter(Boolean).join(" ") || undefined;
    const common = {
      id: `custom-ingredient-${field}`,
      value: draft[field],
      "aria-describedby": describedBy,
      "aria-invalid": Boolean(fieldError),
      style: { fontSize: 16 },
    };
    return (
      <label className="bench-field bench-custom-field" htmlFor={common.id} key={field}>
        <span className="bench-field-label">{label}</span>
        {options.textarea ? (
          <textarea
            {...common}
            rows={3}
            onChange={(event) => update(field, event.target.value)}
          />
        ) : (
          <input
            {...common}
            className="input"
            type="text"
            inputMode={options.numeric ? "decimal" : "text"}
            onChange={(event) => update(field, event.target.value)}
          />
        )}
        {options.hint && <span className="bench-ph-hint" id={hintId}>{options.hint}</span>}
        {fieldError && <span className="bench-inline-error" id={errorId(field)}>{fieldError}</span>}
      </label>
    );
  }

  function renderSelectField<K extends "category" | "toxicity" | "skin" | "water" | "acidBase">(
    field: K,
    label: string,
    options: { value: CustomDraft[K]; label: string }[],
  ) {
    const fieldError = errors[field];
    const id = `custom-ingredient-${field}`;
    return (
      <label className="bench-field bench-custom-field" htmlFor={id} key={field}>
        <span className="bench-field-label">{label}</span>
        <select
          className="select"
          id={id}
          value={draft[field]}
          aria-describedby={fieldError ? errorId(field) : undefined}
          aria-invalid={Boolean(fieldError)}
          style={{ fontSize: 16 }}
          onChange={(event) => update(field, event.target.value as CustomDraft[K])}
        >
          {options.map((option) => (
            <option value={option.value} key={String(option.value)}>{option.label}</option>
          ))}
        </select>
        {fieldError && <span className="bench-inline-error" id={errorId(field)}>{fieldError}</span>}
      </label>
    );
  }

  function renderCheckbox(
    field: "liquid" | "edible" | "biodegradable",
    label: string,
  ) {
    const fieldError = errors[field];
    const id = `custom-ingredient-${field}`;
    return (
      <label className="toggle-row bench-custom-toggle" htmlFor={id} key={field}>
        <span>{label}</span>
        <input
          id={id}
          type="checkbox"
          checked={draft[field]}
          aria-describedby={fieldError ? errorId(field) : undefined}
          aria-invalid={Boolean(fieldError)}
          onChange={(event) => update(field, event.target.checked)}
        />
        {fieldError && <span className="bench-inline-error" id={errorId(field)}>{fieldError}</span>}
      </label>
    );
  }

  function toggleTrait(trait: CustomTrait, checked: boolean) {
    const traits = checked
      ? [...draft.traits, trait]
      : draft.traits.filter((item) => item !== trait);
    update("traits", traits);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateCustomDraft(draft, initial?.id ?? newCustomId());
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    onSave(result.ingredient);
  }

  function deleteIngredient() {
    if (initial && onDelete && window.confirm(`Delete ${initial.name}?`)) onDelete();
  }

  const acidBaseOptions: { value: CustomDraft["acidBase"]; label: string }[] = [
    { value: "neutral", label: "Neutral" },
    { value: "acid", label: "Acid" },
    { value: "base", label: "Base" },
  ];
  const hazardOptions = ([0, 1, 2, 3] as Hazard[]).map((value) => ({
    value,
    label: `${value} — ${hazardWord(value)}`,
  }));
  const waterOptions: { value: WaterBehavior; label: string }[] = [
    { value: "dissolves", label: "Dissolves" },
    { value: "swells", label: "Swells" },
    { value: "resists", label: "Resists" },
  ];

  return (
    <form className="bench-custom-form" onSubmit={submit} aria-label={initial ? "Edit custom ingredient" : "Make your own ingredient"}>
      <div>
        <h4>{initial ? "Edit your ingredient" : "Make your own ingredient"}</h4>
        <p className="bench-muted">
          Your ingredient is modeled from the properties you enter. The Bench can&apos;t predict new reactions for it beyond the traits you tick, so results show lower confidence.
        </p>
      </div>
      <div className="bench-custom-grid">
        {renderStringField("name", "Name")}
        {renderSelectField("category", "Type", categoryOptions)}
        {renderStringField("formula", "Formula (optional)")}
      </div>

      <fieldset className="bench-custom-traits">
        <legend>Traits</legend>
        {traitOptions.map((trait) => {
          const id = `custom-ingredient-trait-${trait.value}`;
          const fieldError = errors.traits;
          return (
            <label className="toggle-row" htmlFor={id} key={trait.value}>
              <span>{trait.label}</span>
              <input
                id={id}
                type="checkbox"
                checked={draft.traits.includes(trait.value)}
                aria-describedby={fieldError ? errorId("traits") : undefined}
                aria-invalid={Boolean(fieldError)}
                onChange={(event) => toggleTrait(trait.value, event.target.checked)}
              />
            </label>
          );
        })}
        {errors.traits && <span className="bench-inline-error" id={errorId("traits")}>{errors.traits}</span>}
      </fieldset>

      <div className="bench-custom-grid">
        {renderStringField("tensileMPa", "Strength (MPa)", { numeric: true })}
        {renderStringField("elongationPct", "Stretch (%)", { numeric: true })}
        {renderStringField("tack", "Stickiness (0–10)", { numeric: true })}
        {renderStringField("density", "Density (g/cm³)", { numeric: true })}
      </div>

      {renderCheckbox("liquid", "It's a liquid")}
      {draft.liquid && (
        <div className="bench-custom-grid">
          {renderStringField("viscosityPas", "Thickness (Pa·s)", {
            numeric: true,
            hint: "water 0.001 · honey ~10",
          })}
        </div>
      )}

      {draft.category === "solvent" && (
        <div className="bench-custom-grid">
          {renderStringField("boilC", "Boiling point (°C)", { numeric: true })}
        </div>
      )}

      <div className="bench-custom-grid">
        {renderSelectField("acidBase", "Acid/base", acidBaseOptions)}
        {draft.acidBase !== "neutral" && (
          <>
            {renderStringField("pKa", "pKa", { numeric: true })}
            {renderStringField("molarMass", "Molar mass (g/mol)", { numeric: true })}
          </>
        )}
      </div>

      <div className="bench-custom-grid">
        {renderSelectField("toxicity", "Toxicity", hazardOptions)}
        {renderSelectField("skin", "Skin", hazardOptions)}
        {renderCheckbox("edible", "Edible")}
        {renderSelectField("water", "In water", waterOptions)}
        {renderCheckbox("biodegradable", "Biodegradable")}
        {renderStringField("costPerKg", "Cost ($/kg)", { numeric: true })}
      </div>
      {renderStringField("notes", "Notes", { textarea: true })}

      <div className="bench-custom-actions">
        <button className="button button-primary" type="submit">Save ingredient</button>
        <button className="button button-secondary" type="button" onClick={onCancel}>Cancel</button>
        {initial && onDelete && (
          <button className="button button-secondary bench-custom-delete" type="button" onClick={deleteIngredient}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
