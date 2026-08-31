export type ImageReadyStatus = 'ready' | 'error' | 'timeout';

export type VisibleImageReadyResult = {
  ready: number;
  error: number;
  total: number;
  timedOut: boolean;
};

const VISIBLE_STATIC_IMAGE_SELECTOR = '.effect-viewport > img.bg, .char-layer img.char-image';
const readyImageSourceKeys = new Set<string>();

function collectImageSourceKeys(source: string): string[] {
  const normalizedSource = source.trim();
  if (!normalizedSource) {
    return [];
  }

  const keys = [normalizedSource];
  if (typeof document !== 'undefined') {
    try {
      const absoluteSource = new URL(normalizedSource, document.baseURI).href;
      if (absoluteSource !== normalizedSource) {
        keys.push(absoluteSource);
      }
    } catch {
      // Keep the raw source as the cache key when URL normalization is not possible.
    }
  }
  return keys;
}

/** Remembers a source that completed both transfer and decode in this browser session. */
export function markImageSourceReady(source: string): void {
  collectImageSourceKeys(source).forEach((key) => readyImageSourceKeys.add(key));
}

/** Returns true only after the source has completed a successful decode. */
export function isImageSourceReady(source: string): boolean {
  return collectImageSourceKeys(source).some((key) => readyImageSourceKeys.has(key));
}

function markImageElementSourceReady(image: HTMLImageElement): void {
  const candidates = [
    typeof image.getAttribute === 'function' ? image.getAttribute('src') : null,
    typeof image.currentSrc === 'string' ? image.currentSrc : null,
    typeof image.src === 'string' ? image.src : null,
  ];
  candidates.forEach((source) => {
    if (source) {
      markImageSourceReady(source);
    }
  });
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function remainingTimeout(startedAt: number, timeoutMs: number): number {
  return Math.max(0, timeoutMs - (now() - startedAt));
}

async function waitForLoad(image: HTMLImageElement, timeoutMs: number): Promise<ImageReadyStatus> {
  if (image.complete) {
    return image.naturalWidth > 0 ? 'ready' : 'error';
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: ImageReadyStatus) => {
      if (settled) {
        return;
      }
      settled = true;
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
      globalThis.clearTimeout(timer);
      resolve(status);
    };
    const handleLoad = () => finish(image.naturalWidth > 0 ? 'ready' : 'error');
    const handleError = () => finish('error');
    const timer = globalThis.setTimeout(() => finish('timeout'), Math.max(0, timeoutMs));

    image.addEventListener('load', handleLoad);
    image.addEventListener('error', handleError);

    // The state can change between the initial check and listener registration.
    if (image.complete) {
      finish(image.naturalWidth > 0 ? 'ready' : 'error');
    }
  });
}

async function waitForDecode(image: HTMLImageElement, timeoutMs: number): Promise<ImageReadyStatus> {
  if (typeof image.decode !== 'function') {
    return 'ready';
  }
  if (timeoutMs <= 0) {
    return 'timeout';
  }

  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<ImageReadyStatus>((resolve) => {
    timer = globalThis.setTimeout(() => resolve('timeout'), timeoutMs);
  });
  const decoded = image.decode().then<ImageReadyStatus, ImageReadyStatus>(
    () => 'ready',
    () => (image.complete && image.naturalWidth > 0 ? 'ready' : 'error'),
  );
  const status = await Promise.race([decoded, timeout]);
  if (timer !== undefined) {
    globalThis.clearTimeout(timer);
  }
  return status;
}

/** Waits for both transfer and decode, so a completed load event cannot race the first paint. */
export async function waitForImageReady(
  image: HTMLImageElement,
  timeoutMs: number,
): Promise<ImageReadyStatus> {
  const startedAt = now();
  const loaded = await waitForLoad(image, timeoutMs);
  if (loaded !== 'ready') {
    return loaded;
  }
  const decoded = await waitForDecode(image, remainingTimeout(startedAt, timeoutMs));
  if (decoded === 'ready') {
    markImageElementSourceReady(image);
  }
  return decoded;
}

/** Waits for the background and currently rendered static characters in the mounted stage. */
export async function waitForVisibleStaticImages(
  root: ParentNode,
  timeoutMs: number,
): Promise<VisibleImageReadyResult> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>(VISIBLE_STATIC_IMAGE_SELECTOR));
  const statuses = await Promise.all(images.map((image) => waitForImageReady(image, timeoutMs)));
  return {
    ready: statuses.filter((status) => status === 'ready').length,
    error: statuses.filter((status) => status === 'error').length,
    total: statuses.length,
    timedOut: statuses.some((status) => status === 'timeout'),
  };
}
