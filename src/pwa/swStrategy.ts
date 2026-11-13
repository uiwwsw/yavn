/**
 * Pure routing rules for the service worker (`src/pwa/sw.ts`), kept free of browser
 * globals so they can be unit-tested. The page also uses the cache names and the
 * offline-pack marker from here, so the worker and the launcher agree on them.
 */

/** Holds the app shell of one build (index.html, boot chunks, icons). Replaced per build. */
export function shellCacheName(version: string): string {
  return `yavn-shell-${version}`;
}

/** Hashed chunks that were not precached (Live2D runtime, notices). Replaced per build. */
export function runtimeCacheName(version: string): string {
  return `yavn-runtime-${version}`;
}

/** The launcher manifest. Survives builds so the launcher still opens offline. */
export const CONTENT_CACHE = 'yavn-content';

const GAME_CACHE_PREFIX = 'yavn-game-';

/** Every file of one game: YAML, assets, offline.json. Survives builds; game content is versioned on its own. */
export function gameCacheName(gameId: string): string {
  return `${GAME_CACHE_PREFIX}${gameId}`;
}

export function gameIdFromCacheName(name: string): string | undefined {
  return name.startsWith(GAME_CACHE_PREFIX) ? name.slice(GAME_CACHE_PREFIX.length) || undefined : undefined;
}

/**
 * Key of the "this game was fully saved" marker inside the game's cache. It is not a
 * real URL the worker ever routes, so runtime caching can never overwrite it.
 */
export function offlineMarkerPath(gameId: string): string {
  return `/__yavn-offline/${encodeURIComponent(gameId)}`;
}

/** Requests the launcher makes while saving a game; the worker lets them go straight to the network. */
export const OFFLINE_DOWNLOAD_HEADER = 'x-yavn-offline-download';

/** Caches that belong to an older build and can go once this build activates. */
export function isObsoleteCache(name: string, version: string): boolean {
  if (name.startsWith('yavn-shell-')) return name !== shellCacheName(version);
  if (name.startsWith('yavn-runtime-')) return name !== runtimeCacheName(version);
  return false;
}

export type SwRoute =
  /** Not ours (other origin, POST, a save download in progress): the browser handles it. */
  | { kind: 'passthrough' }
  /** Always the network. A failure stays a failure (the update check skips quietly). */
  | { kind: 'network-only' }
  /** HTML pages: network first with a short timeout, then the cached page for this route. */
  | { kind: 'navigation'; fallbacks: string[] }
  /** Content that changes without a build (game list, YAML): fresh when online, cached when not. */
  | { kind: 'network-first'; cache: string; missingIsNotFound: boolean }
  /** Game art and sound: serve the cached copy at once, refresh it in the background. */
  | { kind: 'stale-while-revalidate'; cache: string }
  /** Hashed build files never change: cache once, keep. */
  | { kind: 'cache-first'; cache: string };

export type RouteRequest = {
  url: string;
  method: string;
  mode?: string;
  /** Lower-cased header lookup; only `x-yavn-offline-download` is consulted. */
  header?: (name: string) => string | null | undefined;
};

const GAME_PATH = /^\/game-list\/([^/]+)\/(.*)$/;
const GAME_PAGE = /^\/game-list\/([^/.]+)\/?$/;
const CONTENT_FILE = /\.(?:ya?ml|json)$/i;

export function readGameRoute(pathname: string): { gameId: string; file: string } | undefined {
  const match = pathname.match(GAME_PATH);
  if (!match) return undefined;
  try {
    return { gameId: decodeURIComponent(match[1]), file: match[2] };
  } catch {
    return undefined;
  }
}

/** Where a page request falls back to when the network is gone: the route's own page, then the shell. */
export function navigationFallbacks(pathname: string): string[] {
  const game = pathname.match(GAME_PAGE);
  if (game) return [`/game-list/${game[1]}/`, '/'];
  if (/^\/en\/?$/.test(pathname)) return ['/en/', '/'];
  if (pathname === '/' || pathname === '/index.html') return ['/'];
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return [withSlash, '/'];
}

export function routeRequest(request: RouteRequest, origin: string, version: string): SwRoute {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return { kind: 'passthrough' };
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return { kind: 'passthrough' };
  }
  if (url.origin !== origin) return { kind: 'passthrough' };
  if (request.header?.(OFFLINE_DOWNLOAD_HEADER)) return { kind: 'passthrough' };

  const path = url.pathname;
  if (path === '/version.json') return { kind: 'network-only' };
  if (path === '/sw.js') return { kind: 'passthrough' };

  if (request.mode === 'navigate') {
    return method === 'GET' ? { kind: 'navigation', fallbacks: navigationFallbacks(path) } : { kind: 'passthrough' };
  }

  if (path === '/game-list/index.json') return { kind: 'network-first', cache: CONTENT_CACHE, missingIsNotFound: false };

  const game = readGameRoute(path);
  if (game && game.file) {
    const cache = gameCacheName(game.gameId);
    if (CONTENT_FILE.test(game.file)) return { kind: 'network-first', cache, missingIsNotFound: true };
    return { kind: 'stale-while-revalidate', cache };
  }

  if (method !== 'GET') return { kind: 'passthrough' };
  if (path.startsWith('/assets/')) return { kind: 'cache-first', cache: runtimeCacheName(version) };
  // Root files from public/ and the PWA icons: whatever is cached, kept fresh.
  return { kind: 'stale-while-revalidate', cache: runtimeCacheName(version) };
}

export type ByteRange = { start: number; end: number };

/**
 * Parses a single `bytes=` range against a known size. Media elements (Safari above
 * all) ask for ranges and refuse a plain 200 when replaying from the cache.
 */
export function parseByteRange(header: string | null | undefined, size: number): ByteRange | undefined {
  if (!header) return undefined;
  const match = header.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || size <= 0) return undefined;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return undefined;
  let start: number;
  let end: number;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (suffix <= 0) return undefined;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }
  if (start > end || start >= size) return undefined;
  return { start, end };
}

/** What the generated `sw.js` is told at build time. */
export type SwBuildConfig = {
  version: string;
  /** Must all cache for the install to succeed. */
  precache: string[];
  /** Cached when available (game pages are written after the Vite build). */
  optional: string[];
  navigationTimeoutMs: number;
};
