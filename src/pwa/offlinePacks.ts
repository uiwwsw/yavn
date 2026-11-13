import { gameCacheName, OFFLINE_DOWNLOAD_HEADER, offlineMarkerPath } from './swStrategy';

/** `game-list/<id>/offline.json`, written by `scripts/pwa.mjs` at build time. */
export type OfflinePackFile = { path: string; bytes: number; hash: string };
export type OfflinePack = {
  schemaVersion: number;
  id: string;
  version?: string;
  hash: string;
  bytes: number;
  offerable: boolean;
  files: OfflinePackFile[];
};

/** Stored in the game's cache once every file is in: what was saved, file by file. */
export type OfflineMarker = {
  id: string;
  hash: string;
  version?: string;
  bytes: number;
  savedAt: string;
  files: Record<string, string>;
};

export type OfflineStatus =
  /** No pack for this game (dev server, uploaded ZIP) or no Cache API. */
  | 'unsupported'
  | 'too-large'
  | 'not-saved'
  | 'saved'
  /** Saved, but the deployed files differ from what is in the cache. */
  | 'outdated';

export function parseOfflinePack(value: unknown): OfflinePack | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const pack = value as Partial<OfflinePack>;
  if (typeof pack.id !== 'string' || typeof pack.hash !== 'string' || typeof pack.bytes !== 'number' || !Array.isArray(pack.files)) {
    return undefined;
  }
  const files = pack.files.filter((file): file is OfflinePackFile =>
    Boolean(file) && typeof file.path === 'string' && typeof file.bytes === 'number' && typeof file.hash === 'string'
    && !file.path.startsWith('/') && !file.path.split('/').includes('..'));
  return {
    schemaVersion: typeof pack.schemaVersion === 'number' ? pack.schemaVersion : 1,
    id: pack.id,
    version: typeof pack.version === 'string' ? pack.version : undefined,
    hash: pack.hash,
    bytes: pack.bytes,
    offerable: pack.offerable !== false,
    files,
  };
}

export function parseOfflineMarker(value: unknown): OfflineMarker | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const marker = value as Partial<OfflineMarker>;
  if (typeof marker.id !== 'string' || typeof marker.hash !== 'string') return undefined;
  return {
    id: marker.id,
    hash: marker.hash,
    version: typeof marker.version === 'string' ? marker.version : undefined,
    bytes: typeof marker.bytes === 'number' ? marker.bytes : 0,
    savedAt: typeof marker.savedAt === 'string' ? marker.savedAt : '',
    files: marker.files && typeof marker.files === 'object' ? marker.files : {},
  };
}

/**
 * The status shown on a game card. A saved game stays playable offline even when a
 * newer build exists; "outdated" only appears when we could reach the server and the
 * deployed pack differs from the saved one.
 */
export function resolveOfflineStatus(input: {
  supported: boolean;
  pack?: OfflinePack;
  marker?: OfflineMarker;
  reachable: boolean;
}): OfflineStatus {
  const { supported, pack, marker, reachable } = input;
  if (!supported) return 'unsupported';
  if (marker) return reachable && pack && pack.hash !== marker.hash ? 'outdated' : 'saved';
  if (!pack) return 'unsupported';
  return pack.offerable ? 'not-saved' : 'too-large';
}

/** A game can be opened when online, or when it was saved. */
export function canOpenGame(status: OfflineStatus, reachable: boolean): boolean {
  return reachable || status === 'saved' || status === 'outdated';
}

/** Files to fetch (new or changed) and to drop (no longer in the game) when saving over an older save. */
export function planOfflineDownload(pack: OfflinePack, marker?: OfflineMarker) {
  const fetchFiles = marker ? pack.files.filter((file) => marker.files[file.path] !== file.hash) : pack.files;
  const keep = new Set(pack.files.map((file) => file.path));
  const removeFiles = marker ? Object.keys(marker.files).filter((file) => !keep.has(file)) : [];
  return { fetchFiles, removeFiles, bytes: fetchFiles.reduce((sum, file) => sum + file.bytes, 0) };
}

/** "4.8MB", "860KB" — sizes as the store shows them, decimal units. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) {
    const mb = bytes / 1_000_000;
    return `${mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10}MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1000))}KB`;
}

export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22;
}

export function offlineSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window && 'serviceWorker' in navigator && window.isSecureContext;
}

export function gameFileUrl(gameId: string, file: string, origin = window.location.origin): string {
  return new URL(file, `${origin}/game-list/${encodeURIComponent(gameId)}/`).href;
}

export async function fetchOfflinePack(gameId: string): Promise<OfflinePack | undefined> {
  try {
    const response = await fetch(`/game-list/${encodeURIComponent(gameId)}/offline.json`, { cache: 'no-store' });
    if (!response.ok) return undefined;
    return parseOfflinePack(await response.json());
  } catch {
    return undefined;
  }
}

export async function readOfflineMarker(gameId: string): Promise<OfflineMarker | undefined> {
  if (!offlineSupported()) return undefined;
  try {
    const cache = await caches.open(gameCacheName(gameId));
    const hit = await cache.match(offlineMarkerPath(gameId));
    return hit ? parseOfflineMarker(await hit.json()) : undefined;
  } catch {
    return undefined;
  }
}

export class OfflineSaveError extends Error {
  constructor(public readonly reason: 'quota' | 'network') {
    super(reason);
  }
}

/**
 * Puts every file of the game in its cache, four at a time, reporting progress by
 * bytes. The marker is written last, so an interrupted save never reads as saved.
 */
export async function saveGameOffline(
  pack: OfflinePack,
  options: { marker?: OfflineMarker; onProgress?: (ratio: number) => void; concurrency?: number } = {},
): Promise<OfflineMarker> {
  const plan = planOfflineDownload(pack, options.marker);
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota && estimate.usage !== undefined && estimate.quota - estimate.usage < plan.bytes) {
      throw new OfflineSaveError('quota');
    }
  } catch (error) {
    if (error instanceof OfflineSaveError) throw error;
  }
  // Asks the browser not to evict saved games under storage pressure; refusals are fine.
  void navigator.storage?.persist?.().catch(() => false);

  const cache = await caches.open(gameCacheName(pack.id));
  let done = 0;
  const total = Math.max(1, plan.bytes);
  options.onProgress?.(0);
  const queue = [...plan.fetchFiles];
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const url = gameFileUrl(pack.id, file.path);
      let response: Response;
      try {
        response = await fetch(url, { cache: 'no-store', headers: { [OFFLINE_DOWNLOAD_HEADER]: '1' } });
      } catch {
        throw new OfflineSaveError('network');
      }
      if (!response.ok) throw new OfflineSaveError('network');
      try {
        await cache.put(url, response);
      } catch (error) {
        throw isQuotaError(error) ? new OfflineSaveError('quota') : error;
      }
      done += file.bytes;
      options.onProgress?.(Math.min(1, done / total));
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 4, queue.length || 1) }, worker));
  await Promise.all(plan.removeFiles.map((file) => cache.delete(gameFileUrl(pack.id, file))));

  const marker: OfflineMarker = {
    id: pack.id,
    hash: pack.hash,
    version: pack.version,
    bytes: pack.bytes,
    savedAt: new Date().toISOString(),
    files: Object.fromEntries(pack.files.map((file) => [file.path, file.hash])),
  };
  try {
    await cache.put(offlineMarkerPath(pack.id), new Response(JSON.stringify(marker), { headers: { 'Content-Type': 'application/json' } }));
  } catch (error) {
    throw isQuotaError(error) ? new OfflineSaveError('quota') : error;
  }
  options.onProgress?.(1);
  return marker;
}

/** Drops the whole game cache, including what normal play cached along the way. */
export async function removeGameOffline(gameId: string): Promise<void> {
  if (!offlineSupported()) return;
  await caches.delete(gameCacheName(gameId));
}
