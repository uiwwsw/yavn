import { describe, expect, it } from 'vitest';
import {
  CONTENT_CACHE,
  gameCacheName,
  isObsoleteCache,
  navigationFallbacks,
  OFFLINE_DOWNLOAD_HEADER,
  offlineMarkerPath,
  parseByteRange,
  routeRequest,
  runtimeCacheName,
  shellCacheName,
} from './swStrategy';

const origin = 'https://yavn.vercel.app';
const version = '0.2.0-abc1234';
const route = (path: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}) =>
  routeRequest(
    { url: path.startsWith('http') ? path : `${origin}${path}`, method: init.method ?? 'GET', mode: init.mode ?? 'cors', header: (name) => init.headers?.[name] ?? null },
    origin,
    version,
  );

describe('service worker routing', () => {
  it('never answers /version.json from a cache', () => {
    expect(route('/version.json')).toEqual({ kind: 'network-only' });
    expect(route('/version.json?t=1')).toEqual({ kind: 'network-only' });
  });

  it('serves pages network-first with the route page, then the shell, as fallback', () => {
    expect(route('/', { mode: 'navigate' })).toEqual({ kind: 'navigation', fallbacks: ['/'] });
    expect(route('/game-list/8bit-heart/?ui=en', { mode: 'navigate' })).toEqual({ kind: 'navigation', fallbacks: ['/game-list/8bit-heart/', '/'] });
    expect(route('/game-list/8bit-heart', { mode: 'navigate' })).toEqual({ kind: 'navigation', fallbacks: ['/game-list/8bit-heart/', '/'] });
    expect(navigationFallbacks('/en')).toEqual(['/en/', '/']);
    expect(navigationFallbacks('/create/')).toEqual(['/create/', '/']);
  });

  it('keeps the game list and YAML fresh online, cached offline', () => {
    expect(route('/game-list/index.json')).toEqual({ kind: 'network-first', cache: CONTENT_CACHE, missingIsNotFound: false });
    expect(route('/game-list/muwon/3.yaml')).toEqual({ kind: 'network-first', cache: gameCacheName('muwon'), missingIsNotFound: true });
    expect(route('/game-list/muwon/config.yaml', { method: 'HEAD' })).toMatchObject({ kind: 'network-first', cache: 'yavn-game-muwon' });
    expect(route('/game-list/muwon/offline.json')).toMatchObject({ kind: 'network-first', cache: 'yavn-game-muwon' });
  });

  it('serves game art and sound from the per-game cache and refreshes it in the background', () => {
    expect(route('/game-list/8bit-heart/assets/bg/title.svg')).toEqual({ kind: 'stale-while-revalidate', cache: 'yavn-game-8bit-heart' });
    expect(route('/game-list/8bit-heart/assets/bgm/theme.wav')).toEqual({ kind: 'stale-while-revalidate', cache: 'yavn-game-8bit-heart' });
  });

  it('keeps hashed build files once cached and leaves foreign or special requests alone', () => {
    expect(route('/assets/Live2DCharacter-x.js')).toEqual({ kind: 'cache-first', cache: runtimeCacheName(version) });
    expect(route('https://www.youtube.com/iframe_api')).toEqual({ kind: 'passthrough' });
    expect(route('/game-list/index.json', { method: 'POST' })).toEqual({ kind: 'passthrough' });
    expect(route('/sw.js')).toEqual({ kind: 'passthrough' });
    expect(route('/game-list/erase/assets/a.png', { headers: { [OFFLINE_DOWNLOAD_HEADER]: '1' } })).toEqual({ kind: 'passthrough' });
  });

  it('drops only the shell and runtime caches of older builds', () => {
    expect(isObsoleteCache(shellCacheName('old'), version)).toBe(true);
    expect(isObsoleteCache(runtimeCacheName('old'), version)).toBe(true);
    expect(isObsoleteCache(shellCacheName(version), version)).toBe(false);
    expect(isObsoleteCache(gameCacheName('muwon'), version)).toBe(false);
    expect(isObsoleteCache(CONTENT_CACHE, version)).toBe(false);
    expect(isObsoleteCache('someone-else', version)).toBe(false);
  });

  it('keeps the saved-game marker off any routed URL', () => {
    expect(offlineMarkerPath('8bit-heart')).toBe('/__yavn-offline/8bit-heart');
    expect(route(offlineMarkerPath('8bit-heart')).kind).not.toBe('network-first');
  });
});

describe('byte ranges for cached media', () => {
  it('parses open, closed and suffix ranges', () => {
    expect(parseByteRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
  });

  it('rejects ranges it cannot serve', () => {
    expect(parseByteRange(null, 100)).toBeUndefined();
    expect(parseByteRange('bytes=200-', 100)).toBeUndefined();
    expect(parseByteRange('bytes=5-1', 100)).toBeUndefined();
    expect(parseByteRange('bytes=0-1,5-6', 100)).toBeUndefined();
  });
});
