"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  BETA_FEATURES,
  getBetaFeatureSnapshot,
  parseBetaFeatureSettings,
  setBetaFeatureEnabled,
  subscribeToBetaFeatureChanges,
  type BetaFeatureId,
} from "@/lib/beta";

type BetaContextValue = {
  beta: boolean;
  commit: string;
  activeFeatures: BetaFeatureId[];
  isOn: (feature: BetaFeatureId) => boolean;
  setFeature: (feature: BetaFeatureId, enabled: boolean) => void;
};

const BetaContext = createContext<BetaContextValue>({
  beta: false,
  commit: "local",
  activeFeatures: [],
  isOn: () => false,
  setFeature: () => undefined,
});

export function BetaProvider({
  beta,
  commit,
  children,
}: {
  beta: boolean;
  commit: string;
  children: ReactNode;
}) {
  const rawSettings = useSyncExternalStore(
    subscribeToBetaFeatureChanges,
    getBetaFeatureSnapshot,
    () => "",
  );
  const settings = useMemo(() => parseBetaFeatureSettings(rawSettings), [rawSettings]);
  const isOn = useCallback(
    (feature: BetaFeatureId) => beta && settings[feature] !== false,
    [beta, settings],
  );
  const setFeature = useCallback(
    (feature: BetaFeatureId, enabled: boolean) => {
      if (beta) setBetaFeatureEnabled(feature, enabled);
    },
    [beta],
  );
  const activeFeatures = useMemo(
    () => BETA_FEATURES.filter(({ id }) => isOn(id)).map(({ id }) => id),
    [isOn],
  );
  const value = useMemo(
    () => ({ beta, commit, activeFeatures, isOn, setFeature }),
    [beta, commit, activeFeatures, isOn, setFeature],
  );

  return <BetaContext.Provider value={value}>{children}</BetaContext.Provider>;
}

export function useBeta(): BetaContextValue {
  return useContext(BetaContext);
}

export function BetaOnly({ feature, children }: { feature: BetaFeatureId; children: ReactNode }) {
  const { isOn } = useBeta();
  return isOn(feature) ? children : null;
}
