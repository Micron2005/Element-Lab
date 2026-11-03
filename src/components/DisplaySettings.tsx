"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { savePrefs } from "@/lib/prefs";
import { usePrefs } from "./usePrefs";

function Switch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="display-setting">
      <span id={id}>{label}</span>
      <button
        type="button"
        className="display-switch"
        role="switch"
        aria-labelledby={id}
        aria-checked={checked}
        onClick={onChange}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

export default function DisplaySettings() {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function update(next: Partial<typeof prefs>) {
    savePrefs({ ...prefs, ...next });
  }

  return (
    <div className="display-settings" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className="display-toggle"
        aria-expanded={open}
        aria-controls="display-settings-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">◐</span>
        <span>Display</span>
      </button>
      <section
          id="display-settings-panel"
          className="display-panel"
          aria-labelledby="display-settings-title"
          hidden={!open}
        >
          <h2 id="display-settings-title">Display settings</h2>
          <Switch
            id="display-beginner-label"
            label="Beginner mode — tap underlined words for plain-English meanings"
            checked={prefs.beginner}
            onChange={() => update({ beginner: !prefs.beginner })}
          />
          <Switch
            id="display-contrast-label"
            label="High contrast"
            checked={prefs.contrast}
            onChange={() => update({ contrast: !prefs.contrast })}
          />
          <div className="display-setting display-setting-motion">
            <span id="display-motion-label">Reduce motion</span>
            <button
              type="button"
              className="display-switch"
              role="switch"
              aria-labelledby="display-motion-label"
              aria-checked={prefs.motion === "reduce"}
              onClick={() => update({ motion: prefs.motion === "reduce" ? "system" : "reduce" })}
            >
              <span aria-hidden="true" />
            </button>
            <small>Your device setting is always respected.</small>
          </div>
          <Link className="display-glossary-link" href="/glossary" onClick={() => setOpen(false)}>
            Browse the glossary
          </Link>
      </section>
    </div>
  );
}
