import { questsIn, QUESTS, type Stars } from "./quests";

export interface PlayProgress {
  stars: Record<string, Stars>;
}

export const PROGRESS_KEY = "elementlab.play";

function emptyProgress(): PlayProgress {
  return { stars: {} };
}

function validStars(value: unknown): value is Stars {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function loadProgress(): PlayProgress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("stars" in parsed)) {
      return emptyProgress();
    }
    const values = (parsed as { stars?: unknown }).stars;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return emptyProgress();
    }
    const stars: Record<string, Stars> = {};
    for (const [id, value] of Object.entries(values)) {
      if (validStars(value)) stars[id] = value;
    }
    return { stars };
  } catch {
    return emptyProgress();
  }
}

export function recordStars(questId: string, stars: Stars): PlayProgress {
  const progress = loadProgress();
  const next = {
    stars: {
      ...progress.stars,
      [questId]: Math.max(progress.stars[questId] ?? 0, stars) as Stars,
    },
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    } catch {
      return next;
    }
  }
  return next;
}

export function isUnlocked(questId: string, progress: PlayProgress): boolean {
  const quest = QUESTS.find((item) => item.id === questId);
  if (!quest) return false;
  const chapterQuests = questsIn(quest.chapter);
  const index = chapterQuests.findIndex((item) => item.id === questId);
  return index === 0 || (index > 0 && (progress.stars[chapterQuests[index - 1].id] ?? 0) >= 1);
}

export function totalStars(progress: PlayProgress): number {
  return Object.values(progress.stars).reduce<number>((total, stars) => total + stars, 0);
}
