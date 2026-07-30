import { describe, expect, it } from 'vitest';
import { buildImageCharacterRenderKey, resolveCharacterStageLayout } from './characterLayout';

describe('character stage layout', () => {
  it('places exactly two visible characters in stable left and right halves', () => {
    expect(resolveCharacterStageLayout(['left', 'right'])).toEqual({
      mode: 'duo',
      duoSideByPosition: {
        left: 'left',
        right: 'right',
      },
    });

    expect(resolveCharacterStageLayout(['right', 'center'])).toEqual({
      mode: 'duo',
      duoSideByPosition: {
        center: 'left',
        right: 'right',
      },
    });
  });

  it('uses slot order instead of speaker order so characters never swap sides', () => {
    expect(resolveCharacterStageLayout(['center', 'left'])).toEqual({
      mode: 'duo',
      duoSideByPosition: {
        left: 'left',
        center: 'right',
      },
    });
  });

  it('keeps the authored layout for zero, one, or three visible characters', () => {
    expect(resolveCharacterStageLayout([]).mode).toBe('default');
    expect(resolveCharacterStageLayout(['center']).mode).toBe('default');
    expect(resolveCharacterStageLayout(['left', 'center', 'right']).mode).toBe('default');
  });

  it('keeps an image character mounted while only its emotion source changes', () => {
    expect(buildImageCharacterRenderKey('left', '란')).toBe('left-란');
    expect(buildImageCharacterRenderKey('left', '란')).not.toContain('.webp');
  });
});
