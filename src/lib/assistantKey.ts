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
): { provider: Provider; apiKey: string } | { error: string } {
  if (provider !== "anthropic" && provider !== "openai") {
    return { error: "Choose Anthropic or OpenAI." };
  }
  if (typeof apiKey !== "string") return { error: "Enter an API key." };

  const trimmedKey = apiKey.trim();
  if (trimmedKey.length < 20 || trimmedKey.length > 300) {
    return { error: "API keys must be 20–300 characters." };
  }
  if (/\s/.test(trimmedKey)) return { error: "API keys cannot contain internal whitespace." };
  if (provider === "anthropic" && !trimmedKey.startsWith("sk-ant-")) {
    return { error: "Anthropic API keys must start with sk-ant-." };
  }
  if (provider === "openai" && (!trimmedKey.startsWith("sk-") || trimmedKey.startsWith("sk-ant-"))) {
    return { error: "OpenAI API keys must start with sk- and cannot start with sk-ant-." };
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
): Credentials | { error: string } | null {
  if (headers.has("x-user-api-key")) {
    const userCredentials = validateUserKey(
      headers.get("x-user-provider"),
      headers.get("x-user-api-key"),
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
