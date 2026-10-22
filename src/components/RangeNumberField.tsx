import { useState } from "react";

export default function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clampValue = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <label className="bench-field">
      <span className="bench-field-label">{label}</span>
      <span className="bench-field-control">
        <input
          aria-label={`${label} slider`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            setDraft(null);
            onChange(Number(event.target.value));
          }}
        />
        <input
          className="input bench-number-input"
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft ?? String(value)}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            const next = Number(raw);
            if (
              raw.trim() !== "" &&
              Number.isFinite(next) &&
              min <= next &&
              next <= max
            ) {
              onChange(next);
            }
          }}
          onBlur={() => {
            if (draft !== null && draft.trim() !== "") {
              const next = Number(draft);
              if (Number.isFinite(next)) onChange(clampValue(next));
            }
            setDraft(null);
          }}
        />
        <span className="bench-unit">{unit}</span>
      </span>
    </label>
  );
}
