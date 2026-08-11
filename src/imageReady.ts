export type ImageReadyStatus = 'ready' | 'error' | 'timeout';

export type VisibleImageReadyResult = {
  ready: number;
  error: number;
  total: number;
  timedOut: boolean;
};

const VISIBLE_STATIC_IMAGE_SELECTOR = '.effect-viewport > img.bg, .char-layer img.char-image';

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
  return waitForDecode(image, remainingTimeout(startedAt, timeoutMs));
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
