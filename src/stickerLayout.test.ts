import { describe, expect, it } from 'vitest';
import {
  fitStickerWithinFrame,
  type StickerLayoutRect,
} from './stickerLayout';

const projectRect = (
  rect: StickerLayoutRect,
  fit: ReturnType<typeof fitStickerWithinFrame>,
) => {
  const centerX = (rect.left + rect.right) / 2 + fit.translateX;
  const centerY = (rect.top + rect.bottom) / 2 + fit.translateY;
  const width = rect.width * fit.scale;
  const height = rect.height * fit.scale;
  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  };
};

describe('sticker safe-frame fitting', () => {
  it('keeps an already safe sticker unchanged', () => {
    const frame = {
      left: 12,
      right: 378,
      top: 16,
      bottom: 651,
      width: 366,
      height: 635,
    };
    const sticker = {
      left: 74,
      right: 316,
      top: 188,
      bottom: 328,
      width: 242,
      height: 140,
    };

    expect(fitStickerWithinFrame(frame, sticker)).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });

  it('uniformly scales and repositions a tall landscape sticker', () => {
    const frame = {
      left: 20,
      right: 824,
      top: 12,
      bottom: 212,
      width: 804,
      height: 200,
    };
    const sticker = {
      left: 157,
      right: 687,
      top: -65,
      bottom: 241,
      width: 530,
      height: 306,
    };
    const fit = fitStickerWithinFrame(frame, sticker);
    const projected = projectRect(sticker, fit);

    expect(fit.scale).toBeCloseTo(200 / 306);
    expect(projected.left).toBeGreaterThanOrEqual(frame.left);
    expect(projected.right).toBeLessThanOrEqual(frame.right);
    expect(projected.top).toBeCloseTo(frame.top);
    expect(projected.bottom).toBeCloseTo(frame.bottom);
  });

  it('shrinks an oversized sticker to a narrow safe frame', () => {
    const frame = {
      left: 12,
      right: 308,
      top: 12,
      bottom: 378,
      width: 296,
      height: 366,
    };
    const sticker = {
      left: -48,
      right: 368,
      top: 64,
      bottom: 304,
      width: 416,
      height: 240,
    };
    const fit = fitStickerWithinFrame(frame, sticker);
    const projected = projectRect(sticker, fit);

    expect(fit.scale).toBeCloseTo(296 / 416);
    expect(projected.left).toBeCloseTo(frame.left);
    expect(projected.right).toBeCloseTo(frame.right);
    expect(projected.top).toBeGreaterThanOrEqual(frame.top);
    expect(projected.bottom).toBeLessThanOrEqual(frame.bottom);
  });
});
