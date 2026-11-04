"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { savePrefs } from "@/lib/prefs";
import { useT } from "./LocaleProvider";
import { usePrefs } from "./usePrefs";

function setLocaleCookie(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
}

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
  const { locale, t } = useT();
  const router = useRouter();
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

  function changeLocale(next: Locale) {
    setLocaleCookie(next);
    router.refresh();
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
        <span>{t("display.button")}</span>
      </button>
      <section
          id="display-settings-panel"
          className="display-panel"
          aria-labelledby="display-settings-title"
          hidden={!open}
        >
          <h2 id="display-settings-title">{t("display.title")}</h2>
          <fieldset className="display-setting display-language">
            <legend>{t("display.language")}</legend>
            <div className="display-language-options" role="radiogroup" aria-label={t("display.language")}>
              {(["en", "es"] as const).map((option) => (
                <label className="display-language-option" key={option}>
                  <input
                    type="radio"
                    name="display-language"
                    value={option}
                    checked={locale === option}
                    onChange={() => changeLocale(option)}
                  />
                  <span>{t(option === "en" ? "language.en" : "language.es")}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Switch
            id="display-beginner-label"
            label={t("display.beginner")}
            checked={prefs.beginner}
            onChange={() => update({ beginner: !prefs.beginner })}
          />
          <Switch
            id="display-contrast-label"
            label={t("display.contrast")}
            checked={prefs.contrast}
            onChange={() => update({ contrast: !prefs.contrast })}
          />
          <div className="display-setting display-setting-motion">
            <span id="display-motion-label">{t("display.motion")}</span>
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
            <small>{t("display.motionHint")}</small>
          </div>
          <Link className="display-glossary-link" href="/glossary" onClick={() => setOpen(false)}>
            {t("display.glossary")}
          </Link>
      </section>
    </div>
  );
}
