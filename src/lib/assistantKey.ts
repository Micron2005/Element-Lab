import { tr, type Locale } from "./i18n";

export type Provider = "anthropic" | "openai";

export interface Credentials {
  provider: Provider;
  apiKey: string;
  source: "user" | "site";
}

export const USER_KEY_STORAGE = "elementlab.assistant.key";

export function validateUserKey(
  provider: unknown,
  apiKey: unknown,
  locale: Locale = "en",
): { provider: Provider; apiKey: string } | { error: string } {
  if (provider !== "anthropic" && provider !== "openai") {
    return { error: tr(locale, "assistant.keyError.provider") };
  }
  if (typeof apiKey !== "string") return { error: tr(locale, "assistant.keyError.required") };

  const trimmedKey = apiKey.trim();
  if (trimmedKey.length < 20 || trimmedKey.length > 300) {
    return { error: tr(locale, "assistant.keyError.length") };
  }
  if (/\s/.test(trimmedKey)) return { error: tr(locale, "assistant.keyError.whitespace") };
  if (provider === "anthropic" && !trimmedKey.startsWith("sk-ant-")) {
    return { error: tr(locale, "assistant.keyError.anthropicPrefix") };
  }
  if (provider === "openai" && (!trimmedKey.startsWith("sk-") || trimmedKey.startsWith("sk-ant-"))) {
    return { error: tr(locale, "assistant.keyError.openaiPrefix") };
  }

  return { provider, apiKey: trimmedKey };
}

export function resolveCredentials(
  headers: Headers,
  env: {
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    [key: string]: string | undefined;
  },
  locale: Locale = "en",
): Credentials | { error: string } | null {
  if (headers.has("x-user-api-key")) {
    const userCredentials = validateUserKey(
      headers.get("x-user-provider"),
      headers.get("x-user-api-key"),
      locale,
    );
    return "error" in userCredentials
      ? userCredentials
      : { ...userCredentials, source: "user" };
  }
  if (env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", apiKey: env.ANTHROPIC_API_KEY, source: "site" };
  }
  if (env.OPENAI_API_KEY) {
    return { provider: "openai", apiKey: env.OPENAI_API_KEY, source: "site" };
  }
  return null;
}

export function maskKey(apiKey: string): string {
  if (apiKey.length <= 11) return "•".repeat(apiKey.length);
  return `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`;
}
