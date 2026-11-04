import { en, type MessageKey } from "./en";
import { es } from "./es";

export { en, es };
export type { MessageKey };
export type Locale = "en" | "es";
export const LOCALES = ["en", "es"] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";
export type MessageVars = Record<string, string | number>;

export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (cookie === "en" || cookie === "es") return cookie;
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const languages = acceptLanguage.split(",").map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(";");
    const qualityParam = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;
    return { tag: tag.trim().toLowerCase(), quality, index };
  }).filter((entry) => entry.tag && Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const language of languages) {
    const primary = language.tag.split("-")[0];
    if (primary === "en" || primary === "es") return primary;
  }
  return DEFAULT_LOCALE;
}

export function tr(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const english = (en as Partial<Record<MessageKey, string>>)[key];
  const template = (locale === "es" ? (es as Partial<Record<MessageKey, string>>)[key] : undefined) ?? english ?? String(key);
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) =>
    vars && name in vars ? String(vars[name]) : match,
  );
}

const englishTextKeys = new Map<string, MessageKey>();
for (const key of Object.keys(en) as MessageKey[]) {
  if (!englishTextKeys.has(en[key])) englishTextKeys.set(en[key], key);
}

export function trText(locale: Locale, text: string, vars?: MessageVars): string {
  const key = englishTextKeys.get(text);
  return key ? tr(locale, key, vars) : text;
}
