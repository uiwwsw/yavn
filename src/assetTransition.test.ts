import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_BACKGROUND_TRANSITION,
  beginStickerLeave,
  collectBackgroundLayerSources,
  commitPreparedBackground,
  finishBackgroundTransition,
} from './assetTransition';
import type { StickerSlot } from './types';

const readSource = (path: string) => readFileSync(
  fileURLToPath(new URL(path, import.meta.url)),
  'utf8',
);
const appSource = readSource('./App.tsx');
const backgroundTransitionSource = readSource('./BackgroundTransition.tsx');
const engineSource = readSource('./engine.ts');

const sticker: StickerSlot = {
  id: 'evidence',
  source: '/evidence.webp',
  x: '50%',
  y: '30%',
  width: '240px',
  height: undefined,
  anchorX: 'center',
  anchorY: 'center',
  rotate: 0,
  opacity: 1,
  zIndex: 1,
  enterEffect: 'fadeIn',
  enterDuration: 280,
  enterEasing: 'ease',
  enterDelay: 0,
  leaveEffect: 'none',
  leaveDuration: 220,
  leaveEasing: 'ease',
  leaveDelay: 0,
  leaving: false,
  renderKey: 17,
};

describe('asset transition presentation', () => {
  it('keeps the painted background under a decoded replacement until the fade finishes', () => {
    const first = commitPreparedBackground(EMPTY_BACKGROUND_TRANSITION, '/room.webp');
    const second = commitPreparedBackground(first, '/hall.webp');

    expect(second).toEqual({
      current: '/hall.webp',
      previous: '/room.webp',
      revision: 2,
    });
    expect(collectBackgroundLayerSources(second, '/hall.webp')).toEqual([
      '/room.webp',
      '/hall.webp',
    ]);
    expect(finishBackgroundTransition(second, '/hall.webp')).toEqual({
      current: '/hall.webp',
      previous: undefined,
      revision: 2,
    });
  });

  it('does not restart a background transition for a repeated source or stale completion', () => {
    const current = commitPreparedBackground(EMPTY_BACKGROUND_TRANSITION, '/room.webp');

    expect(commitPreparedBackground(current, '/room.webp')).toBe(current);
    expect(finishBackgroundTransition(current, '/stale.webp')).toBe(current);
  });

  it('wires decoded background promotion and stable sticker leave into the runtime', () => {
    expect(appSource).toContain('<BackgroundTransition source={background} />');
    expect(backgroundTransitionSource).toContain('waitForImageReady(image, BACKGROUND_READY_TIMEOUT_MS)');
    expect(backgroundTransitionSource).toContain('latestSourceRef.current !== source');
    expect(backgroundTransitionSource).toContain('data-background-role={role}');
    expect(engineSource).toContain('setSticker(beginStickerLeave(sticker, normalizedLeave))');

    const clearStickerBody = engineSource.match(
      /function clearStickerWithLeave[\s\S]*?\n}\n\nfunction isRecord/,
    )?.[0] ?? '';
    expect(clearStickerBody).not.toContain('renderKey:');
  });

  it('preserves the mounted sticker key and measured placement during leave', () => {
    const leaving = beginStickerLeave(sticker, {
      leaveEffect: 'fadeOut',
      leaveDuration: 220,
      leaveEasing: 'ease-out',
      leaveDelay: 40,
    });

    expect(leaving).not.toBe(sticker);
    expect(leaving.renderKey).toBe(sticker.renderKey);
    expect(leaving.source).toBe(sticker.source);
    expect(leaving.x).toBe(sticker.x);
    expect(leaving.y).toBe(sticker.y);
    expect(leaving.leaving).toBe(true);
    expect(leaving.leaveEffect).toBe('fadeOut');
  });
});
