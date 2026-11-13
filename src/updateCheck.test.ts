import { describe, expect, it } from 'vitest';
import { detectContentVersionChange, findListedGameVersion, hasNewBuild, readGameIdFromPath } from './updateCheck';
import { formatRelativeSaveTime, formatSaveChapter, needsOverwriteConfirm, resolveSlotIntent, truncateSaveLine } from './saveMeta';

const current = { build: '0.2.0', commit: 'abc1234', builtAt: '2026-11-13T00:00:00.000Z' };

describe('update detection', () => {
  it('reports a new build only when the deployed version or commit differs', () => {
    expect(hasNewBuild(current, { ...current })).toBe(false);
    expect(hasNewBuild(current, { ...current, builtAt: '2026-11-14T00:00:00.000Z' })).toBe(false);
    expect(hasNewBuild(current, { ...current, commit: 'def5678' })).toBe(true);
    expect(hasNewBuild(current, { ...current, build: '0.3.0' })).toBe(true);
  });

  it('ignores malformed manifests and local dev builds', () => {
    expect(hasNewBuild(current, undefined)).toBe(false);
    expect(hasNewBuild(current, '<!doctype html>')).toBe(false);
    expect(hasNewBuild(current, { build: '0.3.0' })).toBe(false);
    expect(hasNewBuild({ ...current, commit: 'dev' }, { ...current, commit: 'def5678' })).toBe(false);
    expect(hasNewBuild(current, { ...current, commit: 'dev' })).toBe(false);
  });

  it('describes a content version change of the current game', () => {
    expect(detectContentVersionChange('1.0.0', '1.1.0')).toEqual({ from: '1.0.0', to: '1.1.0' });
    expect(detectContentVersionChange('1.0.0', ' 1.0.0 ')).toBeUndefined();
    expect(detectContentVersionChange(undefined, '1.1.0')).toBeUndefined();
    expect(detectContentVersionChange('1.0.0', undefined)).toBeUndefined();
  });

  it('reads the listed version and the game id from the route', () => {
    const manifest = { games: [{ id: 'muwon', version: '1.2.0' }, { id: 'erase' }] };
    expect(findListedGameVersion(manifest, 'muwon')).toBe('1.2.0');
    expect(findListedGameVersion(manifest, 'erase')).toBeUndefined();
    expect(findListedGameVersion({}, 'muwon')).toBeUndefined();
    expect(readGameIdFromPath('/game-list/8bit-heart/')).toBe('8bit-heart');
    expect(readGameIdFromPath('/')).toBeUndefined();
  });
});

describe('save slot meta', () => {
  const now = Date.parse('2026-11-13T12:00:00.000Z');
  it('formats a relative save time', () => {
    expect(formatRelativeSaveTime('2026-11-13T11:59:40.000Z', now, 'ko')).toBe('방금');
    expect(formatRelativeSaveTime('2026-11-13T11:48:00.000Z', now, 'ko')).toBe('12분 전');
    expect(formatRelativeSaveTime('2026-11-13T09:00:00.000Z', now, 'ko')).toBe('3시간 전');
    expect(formatRelativeSaveTime('2026-11-12T10:00:00.000Z', now, 'ko')).toBe('어제');
    expect(formatRelativeSaveTime('2026-11-09T12:00:00.000Z', now, 'ko')).toBe('4일 전');
    expect(formatRelativeSaveTime(undefined, now, 'ko')).toBe('시각 모름');
  });

  it('truncates the last line and names the chapter', () => {
    expect(truncateSaveLine('  짧은   대사  ')).toBe('짧은 대사');
    expect(truncateSaveLine('가'.repeat(60), 10)).toBe(`${'가'.repeat(9)}…`);
    expect(truncateSaveLine('')).toBeUndefined();
    expect(formatSaveChapter({ exists: true, chapterIndex: 1, chapterTitle: '비 오는 역' }, 'ko')).toBe('2장 · 비 오는 역');
    expect(formatSaveChapter({ exists: true, chapterIndex: 0 }, 'ko')).toBe('1장');
  });

  it('asks before overwriting, deleting or opening an older-version save', () => {
    const empty = { exists: false };
    const filled = { exists: true, savedAt: '2026-11-13T11:00:00.000Z' };
    const old = { ...filled, versionMismatch: true, savedVersion: '1.0.0' };
    expect(needsOverwriteConfirm(empty)).toBe(false);
    expect(needsOverwriteConfirm(filled)).toBe(true);
    expect(resolveSlotIntent('save', 'manual', empty)).toBeUndefined();
    expect(resolveSlotIntent('save', 'manual', filled)).toEqual({ kind: 'overwrite', slot: 'manual' });
    expect(resolveSlotIntent('delete', 'manual2', filled)).toEqual({ kind: 'delete', slot: 'manual2' });
    expect(resolveSlotIntent('delete', 'manual2', empty)).toBeUndefined();
    expect(resolveSlotIntent('load', 'manual3', filled)).toBeUndefined();
    expect(resolveSlotIntent('load', 'auto', old)).toEqual({ kind: 'load-old', slot: 'auto' });
  });
});
