/**
 * YAVN service worker. Bundled into `/sw.js` by `scripts/pwa.mjs`, which defines
 * `__YAVN_SW_CONFIG__` (build version, precache list). Routing decisions live in
 * `swStrategy.ts`; this file only carries them out.
 *
 * Activation is never automatic: a new worker waits until the page's update banner
 * posts `SKIP_WAITING` (after the autosave flush), then the page reloads.
 */
import {
  CONTENT_CACHE,
  isObsoleteCache,
  parseByteRange,
  routeRequest,
  shellCacheName,
  type SwBuildConfig,
  type SwRoute,
} from './swStrategy';

declare const __YAVN_SW_CONFIG__: SwBuildConfig;

// Minimal worker types; the project compiles against the DOM lib only.
type ExtendableEvent = Event & { waitUntil(promise: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & { request: Request; respondWith(response: Promise<Response> | Response): void };
type MessageEvent = ExtendableEvent & { data: unknown };
type WorkerScope = {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

const worker = self as unknown as WorkerScope;
const config = __YAVN_SW_CONFIG__;
const SHELL = shellCacheName(config.version);
const ORIGIN = worker.location.origin;

worker.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    // `reload` skips the HTTP cache so the shell matches this exact deployment.
    await shell.addAll(config.precache.map((url) => new Request(url, { cache: 'reload' })));
    await Promise.all(config.optional.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (response.ok) await shell.put(url, response);
      } catch {
        // Optional entries (game pages, /en/) may not exist in every deployment.
      }
    }));
    try {
      const list = await fetch('/game-list/index.json', { cache: 'no-store' });
      if (list.ok) await (await caches.open(CONTENT_CACHE)).put('/game-list/index.json', list);
    } catch {
      // The launcher caches it on its own first load.
    }
  })());
});

worker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => isObsoleteCache(name, config.version)).map((name) => caches.delete(name)));
    await worker.clients.claim();
  })());
});

worker.addEventListener('message', (event) => {
  const data = event.data as { type?: unknown } | null;
  if (data && data.type === 'SKIP_WAITING') void worker.skipWaiting();
});

worker.addEventListener('fetch', (event) => {
  const request = event.request;
  const route = routeRequest(
    { url: request.url, method: request.method, mode: request.mode, header: (name) => request.headers.get(name) },
    ORIGIN,
    config.version,
  );
  const response = handle(route, request, event);
  if (response) event.respondWith(response);
});

function handle(route: SwRoute, request: Request, event: FetchEvent): Promise<Response> | undefined {
  switch (route.kind) {
    case 'passthrough':
    case 'network-only':
      // Leaving the request alone means an offline `/version.json` simply fails.
      return undefined;
    case 'navigation':
      return navigate(request, route.fallbacks);
    case 'network-first':
      return networkFirst(request, route.cache, route.missingIsNotFound);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request, route.cache, event);
    case 'cache-first':
      return cacheFirst(request, route.cache);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function matchFirst(keys: string[]): Promise<Response | undefined> {
  const shell = await caches.open(SHELL);
  for (const key of keys) {
    const hit = await shell.match(key);
    if (hit) return hit;
  }
  return undefined;
}

async function navigate(request: Request, fallbacks: string[]): Promise<Response> {
  const network = fetch(request);
  try {
    const response = await withTimeout(network, config.navigationTimeoutMs);
    // A 5xx from a broken edge is worse than yesterday's shell.
    if (response.status < 500) return response;
  } catch {
    // Offline or slow: fall through to the shell.
  }
  const cached = await matchFirst(fallbacks);
  if (cached) return cached;
  return network;
}

function plainGet(request: Request): Request {
  return request.method === 'GET' ? request : new Request(request.url, { method: 'GET' });
}

function asHead(response: Response): Response {
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function networkFirst(request: Request, cacheName: string, missingIsNotFound: boolean): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (request.method === 'GET' && response.ok && response.status === 200) {
      await cache.put(request.url, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request.url, { ignoreMethod: true });
    if (cached) return request.method === 'HEAD' ? asHead(cached) : cached;
    // The engine probes for optional YAML files; while offline "not saved" reads as "not there".
    if (missingIsNotFound) return new Response('', { status: 404, headers: { 'x-yavn-offline-miss': '1' } });
    throw error;
  }
}

async function refresh(cache: Cache, url: string): Promise<Response> {
  const response = await fetch(url);
  if (response.ok && response.status === 200) await cache.put(url, response.clone()).catch(() => undefined);
  return response;
}

async function staleWhileRevalidate(request: Request, cacheName: string, event: FetchEvent): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = (await cache.match(request.url, { ignoreMethod: true })) ?? (await caches.match(request.url));
  const range = request.headers.get('range');
  if (cached) {
    // One refresh per asset is enough; skip it for the follow-up range requests of media.
    if (!range || /^bytes=0-$/i.test(range.trim())) {
      event.waitUntil(refresh(cache, request.url).catch(() => undefined));
    }
    if (request.method === 'HEAD') return asHead(cached);
    return range ? rangeResponse(cached, range) : cached;
  }
  if (range) {
    // The network answers a range with a 206, which cannot be cached; fetch the whole file alongside.
    event.waitUntil(refresh(cache, request.url).catch(() => undefined));
    return fetch(request);
  }
  if (request.method === 'HEAD') return fetch(request);
  return refresh(cache, request.url);
}

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request.url);
  if (cached) return cached;
  const response = await fetch(plainGet(request));
  if (response.ok && response.status === 200) {
    const cache = await caches.open(cacheName);
    await cache.put(request.url, response.clone()).catch(() => undefined);
  }
  return response;
}

async function rangeResponse(full: Response, header: string): Promise<Response> {
  const body = await full.arrayBuffer();
  const range = parseByteRange(header, body.byteLength);
  const headers = new Headers(full.headers);
  if (!range) {
    headers.set('Content-Range', `bytes */${body.byteLength}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${body.byteLength}`);
  headers.set('Content-Length', String(range.end - range.start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(body.slice(range.start, range.end + 1), { status: 206, headers });
}
