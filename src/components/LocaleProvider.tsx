"use client";

import { createContext, useCallback, useContext } from "react";
import { en, tr, trText, type Locale, type MessageKey, type MessageVars } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useT() {
  const locale = useContext(LocaleContext);
  const t = useCallback(
    (keyOrEnglish: MessageKey | string, vars?: MessageVars) =>
      Object.prototype.hasOwnProperty.call(en, keyOrEnglish)
        ? tr(locale, keyOrEnglish as MessageKey, vars)
        : trText(locale, keyOrEnglish, vars),
    [locale],
  );
  return { locale, t };
}
