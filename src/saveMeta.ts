import { uiLanguage } from './uiLanguage';

/** Shorten a dialogue line for a save card without cutting a surrogate pair in half. */
export function truncateSaveLine(text: string | undefined, max = 42): string | undefined {
  const normalized = text?.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  const chars = Array.from(normalized);
  return chars.length <= max ? normalized : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

/** "방금", "12분 전", "3시간 전", "어제", "4일 전", then a date. */
export function formatRelativeSaveTime(savedAt: string | undefined, now: number = Date.now(), language: 'ko' | 'en' = uiLanguage): string {
  const time = Date.parse(savedAt ?? '');
  if (!Number.isFinite(time)) return language === 'en' ? 'Unknown time' : '시각 모름';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  const en = language === 'en';
  if (seconds < 60) return en ? 'Just now' : '방금';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return en ? `${minutes} min ago` : `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return en ? `${hours}h ago` : `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return en ? 'Yesterday' : '어제';
  if (days < 7) return en ? `${days} days ago` : `${days}일 전`;
  return new Intl.DateTimeFormat(en ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(time));
}

export type SlotLike = {
  exists: boolean;
  savedAt?: string;
  chapterIndex?: number;
  chapterTitle?: string;
  speaker?: string;
  line?: string;
  savedVersion?: string;
  versionMismatch?: boolean;
};

/** "2장 · 비 오는 역" or "2장" when the chapter has no title. */
export function formatSaveChapter(slot: SlotLike, language: 'ko' | 'en' = uiLanguage): string {
  const number = (slot.chapterIndex ?? 0) + 1;
  const base = language === 'en' ? `Ch. ${number}` : `${number}장`;
  return slot.chapterTitle?.trim() ? `${base} · ${slot.chapterTitle.trim()}` : base;
}

/** Writing to a slot that already holds a save replaces it, so the player confirms first. */
export function needsOverwriteConfirm(slot: SlotLike | undefined): boolean {
  return Boolean(slot?.exists);
}

export type SlotIntent =
  | { kind: 'overwrite'; slot: string }
  | { kind: 'delete'; slot: string }
  | { kind: 'load-old'; slot: string };

/**
 * First click either acts or asks. Returns the intent to confirm, or undefined when the
 * action can run straight away (an empty slot, or a current-version save).
 */
export function resolveSlotIntent(kind: 'save' | 'delete' | 'load', slot: string, summary: SlotLike | undefined): SlotIntent | undefined {
  if (kind === 'save') return needsOverwriteConfirm(summary) ? { kind: 'overwrite', slot } : undefined;
  if (kind === 'delete') return summary?.exists ? { kind: 'delete', slot } : undefined;
  return summary?.versionMismatch ? { kind: 'load-old', slot } : undefined;
}
