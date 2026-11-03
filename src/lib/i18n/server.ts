import "server-only";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { pickLocale, tr, type Locale, type MessageKey, type MessageVars } from "./index";

export async function getLocale(): Promise<Locale> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  return pickLocale(cookieStore.get("lang")?.value, requestHeaders.get("accept-language"));
}

export async function getT() {
  const locale = await getLocale();
  return {
    locale,
    t: (key: MessageKey, vars?: MessageVars) => tr(locale, key, vars),
  };
}

export async function localizedMetadata(titleKey: MessageKey): Promise<Metadata> {
  const { t } = await getT();
  return { title: t(titleKey) };
}
