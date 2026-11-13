import { useCallback, useEffect, useRef, useState } from 'react';
import { BUILD_INFO, type BuildIdentity } from './buildInfo';
import { applyServiceWorkerUpdate, checkServiceWorkerUpdate, hasWaitingServiceWorker, onServiceWorkerWaiting } from './pwa/register';

export const UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * A different deployment is running on the server. Builds are compared by package
 * version and commit; a 'dev' build never reports an update so local work is quiet.
 */
export function hasNewBuild(current: BuildIdentity, remote: unknown): boolean {
  if (!remote || typeof remote !== 'object') return false;
  const { build, commit } = remote as Partial<BuildIdentity>;
  if (typeof build !== 'string' || typeof commit !== 'string' || !build || !commit) return false;
  if (current.commit === 'dev' || commit === 'dev') return false;
  return build !== current.build || commit !== current.commit;
}

export type ContentVersionChange = { from: string; to: string };

/** The current game's authored version differs from the one listed in the deployed game index. */
export function detectContentVersionChange(
  current: string | undefined,
  remote: string | undefined,
): ContentVersionChange | undefined {
  const from = current?.trim();
  const to = remote?.trim();
  if (!from || !to || from === to) return undefined;
  return { from, to };
}

export function readGameIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/game-list\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function findListedGameVersion(manifest: unknown, gameId: string): string | undefined {
  if (!manifest || typeof manifest !== 'object') return undefined;
  const games = (manifest as { games?: unknown }).games;
  if (!Array.isArray(games)) return undefined;
  const entry = games.find((game) => game && typeof game === 'object' && (game as { id?: unknown }).id === gameId) as
    | { version?: unknown }
    | undefined;
  return typeof entry?.version === 'string' ? entry.version : undefined;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

/** What a reload should do once the new page boots. Stored per tab, consumed once. */
export type BootIntent = 'fresh' | 'continue';
const BOOT_INTENT_PREFIX = 'yavn:boot-intent:';

export function setBootIntent(gameId: string, intent: BootIntent): void {
  try { sessionStorage.setItem(`${BOOT_INTENT_PREFIX}${gameId}`, intent); } catch { /* reload still resumes normally */ }
}

export function consumeBootIntent(gameId: string): BootIntent | undefined {
  try {
    const key = `${BOOT_INTENT_PREFIX}${gameId}`;
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value === 'fresh' || value === 'continue' ? value : undefined;
  } catch {
    return undefined;
  }
}

export type UpdateWatchState = {
  buildChanged: boolean;
  remoteBuild?: BuildIdentity;
  contentChange?: ContentVersionChange;
};

/**
 * One build prompt for both signals: `/version.json` names a newer deployment, or a
 * new service worker finished installing and waits. Either one shows the same banner.
 */
export function resolveBuildPrompt(state: UpdateWatchState, swWaiting: boolean): { show: boolean; key?: string } {
  if (state.buildChanged && state.remoteBuild) return { show: true, key: `${state.remoteBuild.build}+${state.remoteBuild.commit}` };
  if (swWaiting) return { show: true, key: 'service-worker' };
  return { show: false };
}

/**
 * Keeps the previous answer when `/version.json` could not be fetched (offline, the
 * service worker lets it fail): an unreachable server is not news about the build.
 */
export function nextUpdateState(
  previous: UpdateWatchState,
  remoteBuild: unknown,
  contentChange: ContentVersionChange | undefined,
  current: BuildIdentity = BUILD_INFO,
): UpdateWatchState {
  if (remoteBuild === undefined) return { ...previous, contentChange: contentChange ?? previous.contentChange };
  const buildChanged = hasNewBuild(current, remoteBuild);
  return { buildChanged, remoteBuild: buildChanged ? (remoteBuild as BuildIdentity) : undefined, contentChange };
}

/**
 * Activates a waiting service worker (if any) after the autosave was flushed, then
 * reloads. The reload happens even when no worker is involved or it does not answer.
 */
export async function reloadIntoNewBuild(reload: () => void = () => window.location.reload()): Promise<void> {
  try {
    await applyServiceWorkerUpdate();
  } finally {
    reload();
  }
}

/**
 * Polls `/version.json` and the game index every five minutes and whenever the tab
 * becomes visible again. It only reports; reloading is always the player's choice.
 */
export function useUpdateWatch(options: { gameId?: string; contentVersion?: string; enabled?: boolean }) {
  const { gameId, contentVersion, enabled = true } = options;
  const [state, setState] = useState<UpdateWatchState>({ buildChanged: false });
  const [swWaiting, setSwWaiting] = useState(() => hasWaitingServiceWorker());
  const [dismissed, setDismissed] = useState<{ build?: string; content?: string }>({});
  const inFlight = useRef(false);

  useEffect(() => onServiceWorkerWaiting(setSwWaiting), []);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [remoteBuild, manifest] = await Promise.all([
        fetchJson('/version.json').catch(() => undefined),
        gameId && contentVersion ? fetchJson('/game-list/index.json').catch(() => undefined) : Promise.resolve(undefined),
      ]);
      const contentChange = gameId ? detectContentVersionChange(contentVersion, findListedGameVersion(manifest, gameId)) : undefined;
      // A newer deployment means a newer sw.js too; let the browser start installing it now.
      if (hasNewBuild(BUILD_INFO, remoteBuild)) checkServiceWorkerUpdate();
      setState((previous) => nextUpdateState(previous, remoteBuild, contentChange));
    } finally {
      inFlight.current = false;
    }
  }, [gameId, contentVersion]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const timer = window.setInterval(() => void check(), UPDATE_POLL_INTERVAL_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [enabled, check]);

  const prompt = resolveBuildPrompt(state, swWaiting);
  const contentKey = state.contentChange ? `${state.contentChange.from}>${state.contentChange.to}` : undefined;
  return {
    buildChanged: prompt.show && prompt.key !== dismissed.build,
    contentChange: contentKey && contentKey !== dismissed.content ? state.contentChange : undefined,
    dismissBuild: () => setDismissed((value) => ({ ...value, build: prompt.key })),
    dismissContent: () => setDismissed((value) => ({ ...value, content: contentKey })),
    check,
  };
}
