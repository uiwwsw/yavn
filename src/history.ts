import type { ChoiceOption, RouteHistoryEntry, StoryLogEntry } from './types';

export function choiceSaveValue(option: ChoiceOption): string {
  return option.saveText ?? option.text;
}

export const MAX_STORY_LOG_ENTRIES = 300;

export function appendStoryLogEntry(history: StoryLogEntry[], entry: StoryLogEntry): StoryLogEntry[] {
  const latest = history[history.length - 1];
  if (latest && JSON.stringify(latest) === JSON.stringify(entry)) {
    return history;
  }
  // Re-presenting a saved message can fill in its sender ID or refresh its portrait.
  if (latest?.kind === 'dialogue' && entry.kind === 'dialogue'
    && latest.channel === 'message' && entry.channel === 'message'
    && latest.chapterPath === entry.chapterPath && latest.sceneId === entry.sceneId
    && latest.actionIndex === entry.actionIndex && latest.thread === entry.thread
    && (latest.side ?? 'them') === (entry.side ?? 'them') && latest.speaker === entry.speaker
    && latest.text === entry.text) {
    return [...history.slice(0, -1), entry];
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
