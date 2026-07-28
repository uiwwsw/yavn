import type { RouteHistoryEntry, StoryLogEntry } from './types';

export const MAX_STORY_LOG_ENTRIES = 300;

export function appendStoryLogEntry(history: StoryLogEntry[], entry: StoryLogEntry): StoryLogEntry[] {
  const latest = history[history.length - 1];
  if (latest && JSON.stringify(latest) === JSON.stringify(entry)) {
    return history;
  }

  const next = [...history, entry];
  return next.length > MAX_STORY_LOG_ENTRIES ? next.slice(-MAX_STORY_LOG_ENTRIES) : next;
}

export function selectRouteHistoryForChapter(
  history: RouteHistoryEntry[],
  chapterPath: string,
): RouteHistoryEntry[] {
  return history.filter((entry) => entry.chapterPath === undefined || entry.chapterPath === chapterPath);
}
