"use client";

import { useState, type FormEvent } from "react";
import {
  draftFromIngredient,
  emptyDraft,
  newCustomId,
  validateCustomDraft,
} from "@/lib/bench/custom";
import {
  CUSTOM_CATEGORY_LABEL_KEYS,
  CUSTOM_HAZARD_LABEL_KEYS,
  CUSTOM_WATER_LABEL_KEYS,
} from "@/lib/bench/displayLabels";
import type { CustomDraft, CustomTrait } from "@/lib/bench/custom";
import type { BenchIngredient, Category, Hazard, WaterBehavior } from "@/lib/bench/types";
import { useT } from "./LocaleProvider";

interface CustomIngredientFormProps {
  initial?: BenchIngredient;
  onSave(ingredient: BenchIngredient): void;
  onCancel(): void;
  onDelete?(): void;
}

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

function errorId(field: keyof CustomDraft): string {
  return `custom-ingredient-${field}-error`;
}

export default function CustomIngredientForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: CustomIngredientFormProps) {
  const { locale, t } = useT();
  const [draft, setDraft] = useState<CustomDraft>(() =>
    initial ? draftFromIngredient(initial) : emptyDraft(),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof CustomDraft, string>>>({});
  const categoryOptions: { value: Category; label: string }[] = (
    Object.keys(CUSTOM_CATEGORY_LABEL_KEYS) as Category[]
  ).map((value) => ({ value, label: t(CUSTOM_CATEGORY_LABEL_KEYS[value]) }));
  const traitOptions: { value: CustomTrait; label: string }[] = [
    { value: "protein", label: t("bench.custom.trait.protein") },
    { value: "diol", label: t("bench.custom.trait.diol") },
    { value: "elastomer", label: t("bench.custom.trait.elastomer") },
  ];

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
    const result = validateCustomDraft(draft, initial?.id ?? newCustomId(), locale);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    onSave(result.ingredient);
  }

  function deleteIngredient() {
    if (initial && onDelete && window.confirm(t("bench.custom.confirmDelete", { name: initial.name }))) onDelete();
  }

  const acidBaseOptions: { value: CustomDraft["acidBase"]; label: string }[] = [
    { value: "neutral", label: t("bench.custom.option.neutral") },
    { value: "acid", label: t("bench.custom.option.acid") },
    { value: "base", label: t("bench.custom.option.base") },
  ];
  const hazardOptions = ([0, 1, 2, 3] as Hazard[]).map((value) => ({
    value,
    label: `${value} — ${t(CUSTOM_HAZARD_LABEL_KEYS[value])}`,
  }));
  const waterOptions: { value: WaterBehavior; label: string }[] = (
    Object.keys(CUSTOM_WATER_LABEL_KEYS) as WaterBehavior[]
  ).map((value) => ({ value, label: t(CUSTOM_WATER_LABEL_KEYS[value]) }));

  return (
    <form className="bench-custom-form" onSubmit={submit} aria-label={t(initial ? "bench.custom.form.ariaEdit" : "bench.custom.form.ariaCreate")}>
      <div>
        <h4>{t(initial ? "bench.custom.heading.edit" : "bench.custom.heading.create")}</h4>
        <p className="bench-muted">{t("bench.custom.intro")}</p>
      </div>
      <div className="bench-custom-grid">
        {renderStringField("name", t("bench.custom.name"))}
        {renderSelectField("category", t("bench.custom.type"), categoryOptions)}
        {renderStringField("formula", t("bench.custom.formula"))}
      </div>

      <fieldset className="bench-custom-traits">
        <legend>{t("bench.custom.traits")}</legend>
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
        {renderStringField("tensileMPa", t("bench.custom.strength"), { numeric: true })}
        {renderStringField("elongationPct", t("bench.custom.stretch"), { numeric: true })}
        {renderStringField("tack", t("bench.custom.stickiness"), { numeric: true })}
        {renderStringField("density", t("bench.custom.density"), { numeric: true })}
      </div>

      {renderCheckbox("liquid", t("bench.custom.liquid"))}
      {draft.liquid && (
        <div className="bench-custom-grid">
          {renderStringField("viscosityPas", t("bench.custom.thickness"), {
            numeric: true,
            hint: t("bench.custom.thicknessHint"),
          })}
        </div>
      )}

      {draft.category === "solvent" && (
        <div className="bench-custom-grid">
          {renderStringField("boilC", t("bench.custom.boilingPoint"), { numeric: true })}
        </div>
      )}

      <div className="bench-custom-grid">
        {renderSelectField("acidBase", t("bench.custom.acidBase"), acidBaseOptions)}
        {draft.acidBase !== "neutral" && (
          <>
            {renderStringField("pKa", t("bench.custom.pKa"), { numeric: true })}
            {renderStringField("molarMass", t("bench.custom.molarMass"), { numeric: true })}
          </>
        )}
      </div>

      <div className="bench-custom-grid">
        {renderSelectField("toxicity", t("bench.custom.toxicity"), hazardOptions)}
        {renderSelectField("skin", t("bench.custom.skin"), hazardOptions)}
        {renderCheckbox("edible", t("bench.custom.edible"))}
        {renderSelectField("water", t("bench.custom.inWater"), waterOptions)}
        {renderCheckbox("biodegradable", t("bench.custom.biodegradable"))}
        {renderStringField("costPerKg", t("bench.custom.cost"), { numeric: true })}
      </div>
      {renderStringField("notes", t("bench.custom.notes"), { textarea: true })}

      <div className="bench-custom-actions">
        <button className="button button-primary" type="submit">{t("bench.custom.save")}</button>
        <button className="button button-secondary" type="button" onClick={onCancel}>{t("bench.custom.cancel")}</button>
        {initial && onDelete && (
          <button className="button button-secondary bench-custom-delete" type="button" onClick={deleteIngredient}>
            {t("bench.custom.delete")}
          </button>
        )}
      </div>
    </form>
  );
}
