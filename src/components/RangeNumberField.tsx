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
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          className="input bench-number-input"
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(clampValue(Number(event.target.value) || 0))}
        />
        <span className="bench-unit">{unit}</span>
      </span>
    </label>
  );
}
