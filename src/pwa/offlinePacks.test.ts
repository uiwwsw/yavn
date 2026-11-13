import { describe, expect, it } from 'vitest';
import {
  canOpenGame,
  formatBytes,
  isQuotaError,
  parseOfflineMarker,
  parseOfflinePack,
  planOfflineDownload,
  resolveOfflineStatus,
  type OfflineMarker,
  type OfflinePack,
} from './offlinePacks';

const pack: OfflinePack = {
  schemaVersion: 1,
  id: '8bit-heart',
  version: '1.0.0',
  hash: 'h2',
  bytes: 4_936_642,
  offerable: true,
  files: [
    { path: 'config.yaml', bytes: 1000, hash: 'a' },
    { path: '0.yaml', bytes: 2000, hash: 'b2' },
    { path: 'assets/bg/new.svg', bytes: 500, hash: 'c' },
  ],
};
const marker: OfflineMarker = {
  id: '8bit-heart', hash: 'h1', version: '1.0.0', bytes: 4_000_000, savedAt: '2026-11-13T00:00:00.000Z',
  files: { 'config.yaml': 'a', '0.yaml': 'b1', 'assets/bg/old.svg': 'd' },
};

describe('offline status', () => {
  it('reads saved, outdated and not saved from the cache marker and the deployed pack', () => {
    expect(resolveOfflineStatus({ supported: true, pack, reachable: true })).toBe('not-saved');
    expect(resolveOfflineStatus({ supported: true, pack, marker: { ...marker, hash: 'h2' }, reachable: true })).toBe('saved');
    expect(resolveOfflineStatus({ supported: true, pack, marker, reachable: true })).toBe('outdated');
  });

  it('stays playable offline even if a newer pack was seen', () => {
    expect(resolveOfflineStatus({ supported: true, pack, marker, reachable: false })).toBe('saved');
    expect(resolveOfflineStatus({ supported: true, marker, reachable: false })).toBe('saved');
  });

  it('does not offer oversize games or saving without cache support', () => {
    expect(resolveOfflineStatus({ supported: true, pack: { ...pack, offerable: false }, reachable: true })).toBe('too-large');
    expect(resolveOfflineStatus({ supported: false, pack, marker, reachable: true })).toBe('unsupported');
    expect(resolveOfflineStatus({ supported: true, reachable: true })).toBe('unsupported');
  });

  it('only lets saved games open while offline', () => {
    expect(canOpenGame('not-saved', true)).toBe(true);
    expect(canOpenGame('not-saved', false)).toBe(false);
    expect(canOpenGame('too-large', false)).toBe(false);
    expect(canOpenGame('unsupported', false)).toBe(false);
    expect(canOpenGame('saved', false)).toBe(true);
    expect(canOpenGame('outdated', false)).toBe(true);
  });
});

describe('offline download plan', () => {
  it('fetches everything the first time', () => {
    expect(planOfflineDownload(pack).fetchFiles).toHaveLength(3);
    expect(planOfflineDownload(pack).bytes).toBe(3500);
  });

  it('fetches only changed files and drops removed ones when updating', () => {
    const plan = planOfflineDownload(pack, marker);
    expect(plan.fetchFiles.map((file) => file.path)).toEqual(['0.yaml', 'assets/bg/new.svg']);
    expect(plan.removeFiles).toEqual(['assets/bg/old.svg']);
    expect(plan.bytes).toBe(2500);
  });
});

describe('offline pack helpers', () => {
  it('formats sizes the way the button shows them', () => {
    expect(formatBytes(4_936_642)).toBe('4.9MB');
    expect(formatBytes(4_800_000)).toBe('4.8MB');
    expect(formatBytes(49_154_921)).toBe('49.2MB');
    expect(formatBytes(860_000)).toBe('860KB');
    expect(formatBytes(10)).toBe('1KB');
  });

  it('recognises quota errors across browsers', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('parses packs and markers defensively', () => {
    expect(parseOfflinePack({ id: 'x' })).toBeUndefined();
    const parsed = parseOfflinePack({ ...pack, files: [...pack.files, { path: '../escape', bytes: 1, hash: 'z' }, { path: '/abs', bytes: 1, hash: 'z' }] });
    expect(parsed?.files).toHaveLength(3);
    expect(parseOfflinePack({ ...pack, offerable: undefined })?.offerable).toBe(true);
    expect(parseOfflineMarker({ id: 'x', hash: 'y' })).toMatchObject({ id: 'x', hash: 'y', files: {} });
    expect(parseOfflineMarker('nope')).toBeUndefined();
  });
});
