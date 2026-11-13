import { describe, expect, it, vi } from 'vitest';
import {
  isImageSourceReady,
  markImageSourceReady,
  waitForImageReady,
  waitForImageReadyWhenVisible,
} from './imageReady';

class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  src = '';
  currentSrc = '';
  decode = vi.fn<() => Promise<void>>();

  getAttribute(name: string): string | null {
    return name === 'src' ? this.src : null;
  }
}

describe('waitForImageReady', () => {
  it('decodes the same element/source only once across concurrent and repeated readiness checks', async () => {
    const image = new FakeImage();
    image.complete = true; image.naturalWidth = 868; image.src = '/one.png';
    image.decode.mockResolvedValue();
    const node = image as unknown as HTMLImageElement;
    await Promise.all([waitForImageReady(node, 1000), waitForImageReady(node, 1000)]);
    await waitForImageReady(node, 1000);
    expect(image.decode).toHaveBeenCalledOnce();
    image.src = '/two.png';
    await waitForImageReady(node, 1000);
    expect(image.decode).toHaveBeenCalledTimes(2);
  });

  it('does not finish at load while decode is still pending', async () => {
    let finishDecode: (() => void) | undefined;
    const image = new FakeImage();
    image.decode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishDecode = resolve;
        }),
    );
    let result: string | undefined;
    const waiting = waitForImageReady(image as unknown as HTMLImageElement, 1000).then((status) => {
      result = status;
    });

    image.complete = true;
    image.naturalWidth = 868;
    image.dispatchEvent(new Event('load'));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

    expect(image.decode).toHaveBeenCalledOnce();
    expect(result).toBeUndefined();

    finishDecode?.();
    await waiting;
    expect(result).toBe('ready');
  });

  it('accepts a loaded image when browser decode rejects after a valid load', async () => {
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 868;
    image.decode.mockRejectedValue(new DOMException('EncodingError'));

    await expect(waitForImageReady(image as unknown as HTMLImageElement, 1000)).resolves.toBe('ready');
  });

  it('reports an image that never finishes loading as timed out', async () => {
    vi.useFakeTimers();
    try {
      const image = new FakeImage();
      const waiting = waitForImageReady(image as unknown as HTMLImageElement, 500);
      await vi.advanceTimersByTimeAsync(500);
      await expect(waiting).resolves.toBe('timeout');
      expect(image.decode).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shares successful decode readiness with later character renderers', async () => {
    const source = '/test-assets/decode-registry-character.webp';
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 868;
    image.src = source;
    image.decode.mockResolvedValue();

    expect(isImageSourceReady(source)).toBe(false);
    await expect(waitForImageReady(image as unknown as HTMLImageElement, 1000)).resolves.toBe('ready');
    expect(isImageSourceReady(source)).toBe(true);

    const manuallyPreparedSource = '/test-assets/manually-prepared-character.webp';
    markImageSourceReady(manuallyPreparedSource);
    expect(isImageSourceReady(manuallyPreparedSource)).toBe(true);
  });
});

describe('waitForImageReadyWhenVisible', () => {
  it('does not report a timeout that happened while the tab was hidden; it retries once visible', async () => {
    const image = new FakeImage();
    image.src = '/hidden-tab.png';
    image.decode.mockResolvedValue();
    let hidden = true;
    const whenVisible = vi.fn(async () => {
      hidden = false;
      image.complete = true;
      image.naturalWidth = 1600;
      setTimeout(() => image.dispatchEvent(new Event('load')), 0);
    });
    const status = await waitForImageReadyWhenVisible(image as unknown as HTMLImageElement, 20, () => hidden, whenVisible);
    expect(whenVisible).toHaveBeenCalledOnce();
    expect(status).toBe('ready');
  });

  it('still reports a timeout while the tab is visible', async () => {
    const image = new FakeImage();
    image.src = '/never.png';
    const whenVisible = vi.fn(async () => {});
    const status = await waitForImageReadyWhenVisible(image as unknown as HTMLImageElement, 20, () => false, whenVisible);
    expect(status).toBe('timeout');
    expect(whenVisible).not.toHaveBeenCalled();
  });
});
