import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchOfflinePack,
  OfflineSaveError,
  offlineSupported,
  readOfflineMarker,
  removeGameOffline,
  resolveOfflineStatus,
  saveGameOffline,
  type OfflineMarker,
  type OfflinePack,
  type OfflineStatus,
} from './offlinePacks';

const PROBE_URL = '/version.json';
const OFFLINE_REPROBE_MS = 15_000;

/**
 * Whether the site itself answers. `navigator.onLine` alone stays true on a captive
 * network or when only our server is down, so it is confirmed with a tiny request
 * that the service worker never answers from the cache.
 */
export function useReachable(): boolean {
  const [reachable, setReachable] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const probe = async () => {
      window.clearTimeout(timer);
      let ok = false;
      if (navigator.onLine !== false) {
        try {
          await fetch(PROBE_URL, { cache: 'no-store', method: 'GET' });
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (cancelled) return;
      setReachable(ok);
      if (!ok) timer = window.setTimeout(() => void probe(), OFFLINE_REPROBE_MS);
    };
    const onOffline = () => { setReachable(false); timer = window.setTimeout(() => void probe(), OFFLINE_REPROBE_MS); };
    const onOnline = () => void probe();
    const onVisible = () => { if (document.visibilityState === 'visible') void probe(); };
    void probe();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return reachable;
}

export type OfflineGameState = {
  status: OfflineStatus;
  pack?: OfflinePack;
  marker?: OfflineMarker;
  /** 0..1 while saving. */
  progress?: number;
  error?: 'quota' | 'network';
};

export type OfflinePacksApi = {
  supported: boolean;
  states: Record<string, OfflineGameState>;
  save: (gameId: string) => Promise<void>;
  remove: (gameId: string) => Promise<void>;
};

/** Offline-save state for every listed game, read from the cache and the deployed packs. */
export function useOfflinePacks(gameIds: readonly string[], reachable: boolean): OfflinePacksApi {
  const supported = offlineSupported();
  const [data, setData] = useState<Record<string, { pack?: OfflinePack; marker?: OfflineMarker }>>({});
  const [progress, setProgress] = useState<Record<string, number | undefined>>({});
  const [errors, setErrors] = useState<Record<string, 'quota' | 'network' | undefined>>({});
  const busy = useRef(new Set<string>());
  const key = gameIds.join('\n');

  useEffect(() => {
    if (!supported || !key) return;
    let cancelled = false;
    void Promise.all(key.split('\n').map(async (id) => {
      const [marker, pack] = await Promise.all([readOfflineMarker(id), fetchOfflinePack(id)]);
      return [id, { marker, pack }] as const;
    })).then((entries) => {
      if (cancelled) return;
      setData((previous) => {
        const next = { ...previous };
        for (const [id, value] of entries) {
          // Keep a known pack when offline; the cached offline.json may be missing.
          next[id] = { marker: value.marker, pack: value.pack ?? previous[id]?.pack };
        }
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [supported, key, reachable]);

  const save = useCallback(async (gameId: string) => {
    if (busy.current.has(gameId)) return;
    busy.current.add(gameId);
    setErrors((value) => ({ ...value, [gameId]: undefined }));
    setProgress((value) => ({ ...value, [gameId]: 0 }));
    try {
      const pack = (await fetchOfflinePack(gameId)) ?? data[gameId]?.pack;
      if (!pack) throw new OfflineSaveError('network');
      const marker = await saveGameOffline(pack, {
        marker: data[gameId]?.marker,
        onProgress: (ratio) => setProgress((value) => ({ ...value, [gameId]: ratio })),
      });
      setData((value) => ({ ...value, [gameId]: { pack, marker } }));
    } catch (error) {
      setErrors((value) => ({ ...value, [gameId]: error instanceof OfflineSaveError ? error.reason : 'network' }));
    } finally {
      busy.current.delete(gameId);
      setProgress((value) => ({ ...value, [gameId]: undefined }));
    }
  }, [data]);

  const remove = useCallback(async (gameId: string) => {
    await removeGameOffline(gameId).catch(() => undefined);
    setErrors((value) => ({ ...value, [gameId]: undefined }));
    setData((value) => ({ ...value, [gameId]: { pack: value[gameId]?.pack, marker: undefined } }));
  }, []);

  const states: Record<string, OfflineGameState> = {};
  for (const id of gameIds) {
    const entry = data[id];
    states[id] = {
      status: resolveOfflineStatus({ supported, pack: entry?.pack, marker: entry?.marker, reachable }),
      pack: entry?.pack,
      marker: entry?.marker,
      progress: progress[id],
      error: errors[id],
    };
  }
  return { supported, states, save, remove };
}
