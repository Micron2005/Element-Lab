import { describe, expect, it } from "vitest";
import { maskKey, resolveCredentials, validateUserKey } from "./assistantKey";

const anthropicKey = `sk-ant-${"a".repeat(24)}`;
const openaiKey = `sk-${"b".repeat(24)}`;

describe("validateUserKey", () => {
  it("accepts Anthropic and OpenAI keys", () => {
    expect(validateUserKey("anthropic", anthropicKey)).toEqual({
      provider: "anthropic",
      apiKey: anthropicKey,
    });
    expect(validateUserKey("openai", openaiKey)).toEqual({
      provider: "openai",
      apiKey: openaiKey,
    });
  });

  it("trims whitespace around a key", () => {
    expect(validateUserKey("anthropic", ` \n${anthropicKey}\t `)).toEqual({
      provider: "anthropic",
      apiKey: anthropicKey,
    });
  });

  it("rejects keys with the wrong provider prefix", () => {
    expect("error" in validateUserKey("openai", anthropicKey)).toBe(true);
    expect("error" in validateUserKey("anthropic", openaiKey)).toBe(true);
  });

  it("rejects short keys, internal whitespace, and unknown providers", () => {
    expect("error" in validateUserKey("anthropic", "sk-ant-too-short")).toBe(true);
    expect("error" in validateUserKey("anthropic", `${anthropicKey.slice(0, 12)} ${anthropicKey.slice(12)}`)).toBe(true);
    expect("error" in validateUserKey("other", anthropicKey)).toBe(true);
  });
});

describe("resolveCredentials", () => {
  it("prefers a valid user key over site keys", () => {
    const headers = new Headers({
      "x-user-api-key": anthropicKey,
      "x-user-provider": "anthropic",
    });
    expect(resolveCredentials(headers, {
      ANTHROPIC_API_KEY: "site-anthropic-key",
      OPENAI_API_KEY: "site-openai-key",
    })).toEqual({ provider: "anthropic", apiKey: anthropicKey, source: "user" });
  });

  it("returns a user-key validation error even when a site key exists", () => {
    const headers = new Headers({
      "x-user-api-key": "not-a-valid-key",
      "x-user-provider": "anthropic",
    });
    expect(resolveCredentials(headers, { ANTHROPIC_API_KEY: "site-key" })).toEqual({
      error: "API keys must be 20–300 characters.",
    });
  });

  it("prefers the Anthropic site key when both providers are configured", () => {
    expect(resolveCredentials(new Headers(), {
      ANTHROPIC_API_KEY: "site-anthropic-key",
      OPENAI_API_KEY: "site-openai-key",
    })).toEqual({ provider: "anthropic", apiKey: "site-anthropic-key", source: "site" });
  });

  it("returns the OpenAI site key when it is the only one configured", () => {
    expect(resolveCredentials(new Headers(), { OPENAI_API_KEY: "site-openai-key" })).toEqual({
      provider: "openai",
      apiKey: "site-openai-key",
      source: "site",
    });
  });

  it("returns null when no credentials are configured", () => {
    expect(resolveCredentials(new Headers(), {})).toBeNull();
  });
});

describe("maskKey", () => {
  it("shows only the beginning and end of a key", () => {
    const masked = maskKey("sk-ant-12345678901234567890");
    expect(masked).toBe("sk-ant-…7890");
    expect(masked).not.toContain("1234567890123456");
  });
});
