import { describe, expect, it } from 'vitest';
import {
  LIVE2D_MAX_DEVICE_PIXEL_RATIO,
  resolveLive2DCanvasPixelRatio,
  shouldRunLive2DTicker,
} from './live2dPerformance';

describe('Live2D transition performance', () => {
  it('caps the backing canvas on high-density mobile screens', () => {
    expect(resolveLive2DCanvasPixelRatio(0.75)).toBe(1);
    expect(resolveLive2DCanvasPixelRatio(1.5)).toBe(1.5);
    expect(resolveLive2DCanvasPixelRatio(3)).toBe(LIVE2D_MAX_DEVICE_PIXEL_RATIO);
    expect(resolveLive2DCanvasPixelRatio(Number.NaN)).toBe(1);
  });

  it('warms hidden models, then parks renderers that cannot paint', () => {
    expect(shouldRunLive2DTicker(false, false, true)).toBe(true);
    expect(shouldRunLive2DTicker(true, false, true)).toBe(false);
    expect(shouldRunLive2DTicker(true, true, false)).toBe(false);
    expect(shouldRunLive2DTicker(true, true, true)).toBe(true);
  });
});
