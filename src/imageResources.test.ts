import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ImageResourceCache } from './imageResources';
import { waitForImageReady } from './imageReady';

class FakeImage extends EventTarget {
  static created: FakeImage[] = [];
  constructor() { super(); FakeImage.created.push(this); }
  complete = false;
  naturalWidth = 20;
  naturalHeight = 20;
  private source = '';
  decode = vi.fn(async () => {});
  remove = vi.fn();
  set src(value: string) { this.source = value; this.complete = Boolean(value); }
  get src() { return this.source; }
  getAttribute(name: string) { return name === 'src' ? this.src : null; }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
}
const source = 'https://game.test/portrait.png';
let cache: ImageResourceCache;
let requests: ReturnType<typeof vi.fn>;
let blobs: MockInstance<typeof URL.createObjectURL>;
let revokes: MockInstance<typeof URL.revokeObjectURL>;
beforeEach(() => {
  FakeImage.created = [];
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('document', { baseURI: 'https://game.test/' });
  vi.stubGlobal('location', { origin: 'https://game.test' });
  requests = vi.fn(async () => new Response(new Blob(['image'], { type: 'image/png' })));
  vi.stubGlobal('fetch', requests);
  let count = 0;
  blobs = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:prepared-${++count}`);
  revokes = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  cache = new ImageResourceCache();
});
afterEach(() => { cache.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('shared scene image resources', () => {
  it('warms upcoming chapter bytes without decoding images before they are needed', async () => {
    await expect(cache.prefetch(source)).resolves.toBe('ready');
    expect(requests).toHaveBeenCalledOnce();
    expect(FakeImage.created).toHaveLength(0);
    const lease = cache.acquire(source);
    await lease.ready;
    expect(FakeImage.created).toHaveLength(1);
    expect(requests).toHaveBeenCalledOnce();
    expect((lease.image as unknown as FakeImage).decode).toHaveBeenCalledOnce();
    lease.release();
  });

  it('lends the exact predecoded node across relative URLs, absolute URLs and repeated appearances', async () => {
    await expect(cache.prepare('/portrait.png')).resolves.toBe('ready');
    const first = cache.acquire(source);
    await expect(waitForImageReady(first.image, 1000)).resolves.toBe('ready');
    first.release();
    const second = cache.acquire('./portrait.png');
    await expect(second.ready).resolves.toBe('ready');
    expect(second.image).toBe(first.image);
    expect((second.image as unknown as FakeImage).decode).toHaveBeenCalledOnce();
    expect(requests).toHaveBeenCalledOnce();
    expect(blobs).toHaveBeenCalledOnce();
    second.release();
  });

  it('coalesces concurrent preload/render requests and keeps simultaneous owners on separate nodes', async () => {
    const preload = cache.prepare(source);
    const a = cache.acquire(source);
    const b = cache.acquire(source);
    expect(a.image).not.toBe(b.image);
    await expect(Promise.all([preload, a.ready, b.ready])).resolves.toEqual(['ready', 'ready', 'ready']);
    expect(a.image.src).toBe(b.image.src);
    expect(requests).toHaveBeenCalledOnce();
    expect(blobs).toHaveBeenCalledOnce();
    a.release();
    expect(b.image.src).toBe('blob:prepared-1');
    b.release();
  });

  it('keeps the mounted image valid through reset, then revokes owned bytes after its last release', async () => {
    const lease = cache.acquire(source);
    await lease.ready;
    cache.clear();
    expect(revokes).not.toHaveBeenCalled();
    expect(lease.image.src).toBe('blob:prepared-1');
    lease.release(); lease.release();
    expect(revokes).toHaveBeenCalledExactlyOnceWith('blob:prepared-1');
    await expect(cache.prepare(source)).resolves.toBe('ready');
    expect(requests).toHaveBeenCalledTimes(2);
  });

  it('evicts idle decoded pixels while retaining shared bytes, and never evicts a mounted node', async () => {
    cache = new ImageResourceCache({ encodedBytes: 1000, decodedBytes: 0, entries: 10 });
    const first = cache.acquire(source);
    await first.ready;
    expect(first.image.src).toBe('blob:prepared-1');
    first.release();
    expect(first.image.src).toBe('');
    const next = cache.acquire(source);
    await expect(next.ready).resolves.toBe('ready');
    expect(next.image).not.toBe(first.image);
    expect(requests).toHaveBeenCalledOnce();
    next.release();
  });

  it('releases idle encoded data when its budget is exceeded', async () => {
    cache = new ImageResourceCache({ encodedBytes: 0, decodedBytes: 10000, entries: 10 });
    await cache.prepare(source);
    expect(revokes).toHaveBeenCalledExactlyOnceWith('blob:prepared-1');
    await cache.prepare(source);
    expect(requests).toHaveBeenCalledTimes(2);
  });

  it('retries a failed source instead of caching failed readiness forever', async () => {
    requests.mockResolvedValueOnce(new Response('missing', { status: 404 }));
    await expect(cache.prepare(source)).resolves.toBe('error');
    await expect(cache.prepare(source)).resolves.toBe('ready');
    expect(requests).toHaveBeenCalledTimes(2);
  });

  it('aborts an in-flight transfer on reset without publishing a stale object URL', async () => {
    requests.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const preparing = cache.prepare(source);
    cache.clear();
    await expect(preparing).resolves.toBe('error');
    expect(blobs).not.toHaveBeenCalled();
  });

  it('preserves native cross-origin loading and never revokes externally owned ZIP blob URLs', async () => {
    const external = cache.acquire('https://cdn.test/no-cors.png');
    await external.ready;
    expect(external.image.src).toBe('https://cdn.test/no-cors.png');
    const zip = cache.acquire('blob:zip-owned');
    await zip.ready;
    expect(zip.image.src).toBe('blob:zip-owned');
    external.release(); zip.release(); cache.clear();
    expect(requests).not.toHaveBeenCalled();
    expect(revokes).not.toHaveBeenCalled();
  });
});
