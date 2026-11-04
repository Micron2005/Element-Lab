import type { MessageKey } from "./i18n";

export const BETA_COOKIE = "beta";
export const BETA_FEATURE_STORAGE_KEY = "elementlab.betaFeatures";
export const BETA_FEATURES_CHANGE_EVENT = "elementlab:beta-features";

export type BetaFeatureId = "report-problem";
export type BetaFeatureSettings = Record<BetaFeatureId, boolean>;

export const BETA_FEATURES: readonly {
  id: BetaFeatureId;
  titleKey: MessageKey;
  descKey: MessageKey;
}[] = [
  {
    id: "report-problem",
    titleKey: "beta.feature.reportProblem.title",
    descKey: "beta.feature.reportProblem.description",
  },
];

let memorySnapshot = "";

export function isBetaCookie(value: string | undefined): boolean {
  return value === "1";
}

export function defaultBetaFeatureSettings(): BetaFeatureSettings {
  return Object.fromEntries(BETA_FEATURES.map(({ id }) => [id, true])) as BetaFeatureSettings;
}

export function parseBetaFeatureSettings(raw: string | null): BetaFeatureSettings {
  const settings = defaultBetaFeatureSettings();
  if (!raw) return settings;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return settings;
    for (const { id } of BETA_FEATURES) {
      const value = (stored as Record<string, unknown>)[id];
      if (typeof value === "boolean") settings[id] = value;
    }
  } catch {
    return settings;
  }
  return settings;
}

export function getBetaFeatureSnapshot(): string {
  try {
    const stored = window.localStorage.getItem(BETA_FEATURE_STORAGE_KEY);
    return stored ?? memorySnapshot;
  } catch {
    return memorySnapshot;
  }
}

export function subscribeToBetaFeatureChanges(onChange: () => void): () => void {
  const update = (event: Event) => {
    if (event.type === "storage") {
      memorySnapshot = (event as StorageEvent).newValue ?? "";
    }
    onChange();
  };
  window.addEventListener("storage", update);
  window.addEventListener(BETA_FEATURES_CHANGE_EVENT, update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener(BETA_FEATURES_CHANGE_EVENT, update);
  };
}

export function setBetaFeatureEnabled(feature: BetaFeatureId, enabled: boolean): void {
  const settings = parseBetaFeatureSettings(getBetaFeatureSnapshot());
  settings[feature] = enabled;
  memorySnapshot = JSON.stringify(settings);
  try {
    window.localStorage.setItem(BETA_FEATURE_STORAGE_KEY, memorySnapshot);
  } catch {
    // Keep the in-memory toggle usable when storage is unavailable.
  }
  window.dispatchEvent(new Event(BETA_FEATURES_CHANGE_EVENT));
}
