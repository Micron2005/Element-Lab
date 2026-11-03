export interface Prefs {
  beginner: boolean;
  contrast: boolean;
  motion: "system" | "reduce";
}

export const DEFAULT_PREFS: Prefs = {
  beginner: false,
  contrast: false,
  motion: "system",
};

export const PREFS_KEY = "elementlab.prefs";
export const PREFS_CHANGE_EVENT = "elementlab:prefs";

export function parsePrefs(raw: string | null): Prefs {
  if (raw === null) return { ...DEFAULT_PREFS };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_PREFS };
    const prefs = value as Record<string, unknown>;
    return {
      beginner: typeof prefs.beginner === "boolean" ? prefs.beginner : DEFAULT_PREFS.beginner,
      contrast: typeof prefs.contrast === "boolean" ? prefs.contrast : DEFAULT_PREFS.contrast,
      motion: prefs.motion === "reduce" || prefs.motion === "system" ? prefs.motion : DEFAULT_PREFS.motion,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function loadPrefs(): Prefs {
  try {
    return parsePrefs(window.localStorage.getItem(PREFS_KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  root.dataset.beginner = prefs.beginner ? "1" : "0";
  root.dataset.contrast = prefs.contrast ? "1" : "0";
  root.dataset.motion = prefs.motion;
}

export function savePrefs(prefs: Prefs): void {
  const next = parsePrefs(JSON.stringify(prefs));
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory display settings usable when storage is unavailable.
  }
  applyPrefs(next);
  window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
}

export const PREFS_SCRIPT = `(function(){var d=document.documentElement.dataset;try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"null");p=p&&typeof p==="object"&&!Array.isArray(p)?p:{};d.beginner=p.beginner===true?"1":"0";d.contrast=p.contrast===true?"1":"0";d.motion=p.motion==="reduce"||p.motion==="system"?p.motion:"system"}catch(e){d.beginner="0";d.contrast="0";d.motion="system"}})()`;
