/**
 * Page side of the service worker: registration in production, and the hand-off the
 * update banner uses. A new worker never takes over on its own; `applyServiceWorkerUpdate`
 * activates it only after the player pressed [지금 반영] and the autosave was flushed.
 */

type Listener = (waiting: boolean) => void;

let registration: ServiceWorkerRegistration | undefined;
let waitingWorker: ServiceWorker | undefined;
const listeners = new Set<Listener>();

/** Secure origins only; `localhost`/`127.0.0.1` count as secure. */
export function canUseServiceWorker(env: { isProd: boolean; secure: boolean; supported: boolean }): boolean {
  return env.isProd && env.secure && env.supported;
}

function setWaiting(worker: ServiceWorker | undefined) {
  // Without a controller this is the first install, not an update.
  const next = worker && navigator.serviceWorker.controller ? worker : undefined;
  if (next === waitingWorker) return;
  waitingWorker = next;
  for (const listener of listeners) listener(Boolean(waitingWorker));
}

function track(reg: ServiceWorkerRegistration) {
  registration = reg;
  const watch = (installing: ServiceWorker | null) => {
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') setWaiting(reg.waiting ?? installing);
    });
  };
  if (reg.waiting) setWaiting(reg.waiting);
  // The browser may have started fetching a new sw.js on this navigation before `register()` resolved.
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));
}

export function hasWaitingServiceWorker(): boolean {
  return Boolean(waitingWorker);
}

export function onServiceWorkerWaiting(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isServiceWorkerActive(): boolean {
  return Boolean(registration?.active);
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const enabled = canUseServiceWorker({
    isProd: import.meta.env.PROD,
    secure: window.isSecureContext,
    supported: true,
  });
  if (!enabled) {
    // A worker left over from a production preview on this origin would serve stale dev files.
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(registrations.map((reg) => reg.unregister().catch(() => false)));
    return;
  }
  try {
    track(await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
  } catch {
    // Private modes and some embedded browsers refuse; the site still works online.
  }
}

/** Ask the browser to fetch `/sw.js` again, e.g. after `/version.json` named a new build. */
export function checkServiceWorkerUpdate(): void {
  void registration?.update().catch(() => undefined);
}

function waitFor(predicate: () => boolean, target: EventTarget | undefined, event: string, timeoutMs: number): Promise<boolean> {
  if (predicate()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (value: boolean) => { clearTimeout(timer); target?.removeEventListener(event, onEvent); resolve(value); };
    const onEvent = () => { if (predicate()) done(true); };
    const timer = setTimeout(() => done(predicate()), timeoutMs);
    target?.addEventListener(event, onEvent);
  });
}

/**
 * Bring the newest worker in before the reload: fetch it if the browser has not yet,
 * let it take over, and resolve once it controls this page (or after a timeout; the
 * reload then still gets fresh HTML because navigations go to the network first).
 */
export async function applyServiceWorkerUpdate({ installTimeoutMs = 8000, takeoverTimeoutMs = 4000 } = {}): Promise<void> {
  const reg = registration;
  if (!reg || !navigator.serviceWorker.controller) return;
  if (!reg.waiting) {
    await reg.update().catch(() => undefined);
    const installing = reg.installing;
    if (installing) {
      await waitFor(() => installing.state === 'installed' || installing.state === 'redundant', installing, 'statechange', installTimeoutMs);
    }
  }
  const waiting = reg.waiting;
  if (!waiting) return;
  const before = navigator.serviceWorker.controller;
  const takeover = waitFor(() => navigator.serviceWorker.controller !== before, navigator.serviceWorker, 'controllerchange', takeoverTimeoutMs);
  waiting.postMessage({ type: 'SKIP_WAITING' });
  await takeover;
}
