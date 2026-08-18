import { describe, expect, it } from 'vitest';
import {
  fitStickerWithinFrame,
  fitStickerWithinFrameAvoidingRects,
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

describe('sticker character collision avoidance', () => {
  const frame = {
    left: 0,
    right: 1000,
    top: 0,
    bottom: 600,
    width: 1000,
    height: 600,
  };

  it('keeps the authored position when no character overlaps it', () => {
    const sticker = {
      left: 400,
      right: 600,
      top: 40,
      bottom: 140,
      width: 200,
      height: 100,
    };
    const character = {
      left: 380,
      right: 620,
      top: 180,
      bottom: 600,
      width: 240,
      height: 420,
    };

    expect(fitStickerWithinFrameAvoidingRects(frame, sticker, [character], 20)).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });

  it('moves a centered item to the nearest open side of a solo character', () => {
    const sticker = {
      left: 400,
      right: 600,
      top: 260,
      bottom: 380,
      width: 200,
      height: 120,
    };
    const character = {
      left: 400,
      right: 600,
      top: 100,
      bottom: 600,
      width: 200,
      height: 500,
    };
    const fit = fitStickerWithinFrameAvoidingRects(frame, sticker, [character], 20);
    const projected = projectRect(sticker, fit);

    expect(fit.scale).toBe(1);
    expect(projected.right).toBeLessThanOrEqual(character.left - 20);
    expect(projected.left).toBeGreaterThanOrEqual(frame.left);
    expect(projected.bottom).toBeLessThanOrEqual(frame.bottom);
  });

  it('uses the open top area when two actors block the horizontal options', () => {
    const sticker = {
      left: 350,
      right: 650,
      top: 260,
      bottom: 360,
      width: 300,
      height: 100,
    };
    const characters = [
      {
        left: 80,
        right: 400,
        top: 140,
        bottom: 600,
        width: 320,
        height: 460,
      },
      {
        left: 600,
        right: 920,
        top: 140,
        bottom: 600,
        width: 320,
        height: 460,
      },
    ];
    const fit = fitStickerWithinFrameAvoidingRects(frame, sticker, characters, 20);
    const projected = projectRect(sticker, fit);

    expect(fit.scale).toBe(1);
    expect(projected.bottom).toBeLessThanOrEqual(120);
    expect(projected.left).toBeGreaterThanOrEqual(frame.left);
    expect(projected.right).toBeLessThanOrEqual(frame.right);
  });

  it('scales only when the current size has no collision-free position', () => {
    const narrowFrame = {
      left: 0,
      right: 500,
      top: 0,
      bottom: 400,
      width: 500,
      height: 400,
    };
    const sticker = {
      left: 100,
      right: 400,
      top: 100,
      bottom: 300,
      width: 300,
      height: 200,
    };
    const character = {
      left: 120,
      right: 380,
      top: 80,
      bottom: 400,
      width: 260,
      height: 320,
    };
    const fit = fitStickerWithinFrameAvoidingRects(narrowFrame, sticker, [character], 20);
    const projected = projectRect(sticker, fit);

    expect(fit.scale).toBeLessThan(1);
    expect(projected.left).toBeGreaterThanOrEqual(narrowFrame.left);
    expect(projected.right).toBeLessThanOrEqual(narrowFrame.right);
    expect(projected.top).toBeGreaterThanOrEqual(narrowFrame.top);
    expect(projected.bottom).toBeLessThanOrEqual(narrowFrame.bottom);
  });
});
