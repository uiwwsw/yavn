import { decodeImageElement, registerImagePreparation, type ImageReadyStatus } from './imageReady';

const READY_TIMEOUT_MS = 12000;
const MAX_ENCODED_BYTES = 64 * 1024 * 1024;
const MAX_DECODED_BYTES = 96 * 1024 * 1024;
const MAX_RESOURCES = 80;

type ImageInstance = { image: HTMLImageElement; ready: Promise<ImageReadyStatus>; leased: boolean; bytes: number; used: number };
type ImageResource = {
  key: string; source: Promise<string>; objectUrl?: string; encodedBytes: number;
  instances: ImageInstance[]; users: number; used: number; disposed: boolean; abort: AbortController;
};
export type ImageLease = { image: HTMLImageElement; ready: Promise<ImageReadyStatus>; release: () => void };

/** Owns image bytes and decoded nodes; renderers borrow nodes instead of loading the URL again. */
export class ImageResourceCache {
  private resources = new Map<string, ImageResource>();
  private tick = 0;
  constructor(private limits = { encodedBytes: MAX_ENCODED_BYTES, decodedBytes: MAX_DECODED_BYTES, entries: MAX_RESOURCES }) {}

  private canonical(source: string): string {
    try { return new URL(source, document.baseURI).href; } catch { return source; }
  }

  private get(source: string): ImageResource {
    const key = this.canonical(source);
    let entry = this.resources.get(key);
    if (entry) { entry.used = ++this.tick; return entry; }
    entry = { key, source: Promise.resolve(key), encodedBytes: 0, instances: [], users: 0, used: ++this.tick, disposed: false, abort: new AbortController() };
    this.resources.set(key, entry);
    const resource = entry;
    // Same-origin assets get one shared byte payload even with cache disabled/no-store.
    // Foreign images retain native <img> loading, including servers without CORS headers.
    let sameOrigin = false;
    try { const url = new URL(key); sameOrigin = /^https?:$/.test(url.protocol) && url.origin === location.origin; } catch { /* data/blob/native URL */ }
    if (sameOrigin) {
      resource.source = (async () => {
        const timer = globalThis.setTimeout(() => resource.abort.abort(), READY_TIMEOUT_MS);
        try {
          const response = await fetch(key, { cache: 'force-cache', signal: resource.abort.signal });
          if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
          const blob = await response.blob();
          if (resource.disposed) throw new Error('Image resource released');
          resource.encodedBytes = blob.size;
          resource.objectUrl = URL.createObjectURL(blob);
          return resource.objectUrl;
        } finally { globalThis.clearTimeout(timer); }
      })();
    }
    return resource;
  }

  private instance(entry: ImageResource): ImageInstance {
    const image = new Image();
    image.decoding = 'async'; image.loading = 'eager'; image.fetchPriority = 'high';
    const instance: ImageInstance = { image, leased: false, ready: Promise.resolve('error'), bytes: 0, used: ++this.tick };
    entry.instances.push(instance);
    instance.ready = entry.source.then(async source => {
      if (entry.disposed) return 'error' as const;
      image.src = source;
      const status = await decodeImageElement(image, READY_TIMEOUT_MS);
      if (status === 'ready') instance.bytes = image.naturalWidth * image.naturalHeight * 4;
      return status;
    }).catch(() => 'error' as const);
    registerImagePreparation(image, instance.ready);
    void instance.ready.then(status => {
      if (status !== 'ready') this.discard(entry);
      this.trim();
    });
    return instance;
  }

  /** Preload may share a mounted image's preparation without stealing its DOM node. */
  async prepare(source: string): Promise<ImageReadyStatus> {
    const entry = this.get(source);
    entry.users += 1;
    try { return await (entry.instances[0] ?? this.instance(entry)).ready; }
    finally { entry.users -= 1; if (entry.disposed) this.disposeIfUnused(entry); else this.trim(); }
  }

  /** Background chapter warming only transfers bytes; it cannot displace current decoded frames. */
  async prefetch(source: string): Promise<ImageReadyStatus> {
    const entry = this.get(source);
    entry.users += 1;
    try { await entry.source; return entry.disposed ? 'error' : 'ready'; }
    catch { this.discard(entry); return 'error'; }
    finally { entry.users -= 1; if (entry.disposed) this.disposeIfUnused(entry); else this.trim(); }
  }

  acquire(source: string): ImageLease {
    const entry = this.get(source);
    const instance = entry.instances.find(item => !item.leased) ?? this.instance(entry);
    instance.leased = true; instance.used = ++this.tick; entry.users += 1;
    let released = false;
    return { image: instance.image, ready: instance.ready, release: () => {
      if (released) return;
      released = true; instance.leased = false; instance.used = ++this.tick; entry.users -= 1;
      instance.image.remove();
      if (entry.disposed) this.disposeIfUnused(entry);
      else this.trim();
    } };
  }

  private disposeIfUnused(entry: ImageResource): void {
    if (entry.users > 0) return;
    entry.abort.abort();
    entry.instances.forEach(instance => { instance.image.removeAttribute('src'); });
    entry.instances = [];
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    entry.objectUrl = undefined;
  }

  private discard(entry: ImageResource): void {
    if (this.resources.get(entry.key) === entry) this.resources.delete(entry.key);
    entry.disposed = true;
    entry.abort.abort();
    this.disposeIfUnused(entry);
  }

  private trim(): void {
    const entries = [...this.resources.values()];
    let decoded = entries.reduce((sum, entry) => sum + entry.instances.reduce((n, i) => n + i.bytes, 0), 0);
    const idle = entries.flatMap(entry => entry.instances.filter(i => !i.leased && i.bytes > 0 && entry.users === 0).map(instance => ({ entry, instance })))
      .sort((a, b) => a.instance.used - b.instance.used);
    for (const { entry, instance } of idle) {
      if (decoded <= this.limits.decodedBytes) break;
      entry.instances = entry.instances.filter(i => i !== instance);
      instance.image.removeAttribute('src');
      decoded -= instance.bytes;
    }
    let encoded = entries.reduce((sum, entry) => sum + entry.encodedBytes, 0);
    for (const entry of entries.sort((a, b) => a.used - b.used)) {
      if (encoded <= this.limits.encodedBytes && this.resources.size <= this.limits.entries) break;
      if (entry.users > 0) continue;
      encoded -= entry.encodedBytes;
      this.discard(entry);
    }
  }

  invalidate(source: string): void {
    const entry = this.resources.get(this.canonical(source));
    if (entry) this.discard(entry);
  }

  clear(): void { for (const entry of this.resources.values()) this.discard(entry); }
}

export const imageResources = new ImageResourceCache();
