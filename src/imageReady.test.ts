import { describe, expect, it, vi } from 'vitest';
import { waitForImageReady } from './imageReady';

class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  decode = vi.fn<() => Promise<void>>();
}

describe('waitForImageReady', () => {
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
});
