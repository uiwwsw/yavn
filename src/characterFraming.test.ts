import { describe, expect, it } from 'vitest';
import { resolveCharacterFraming } from './characterFraming';
import type { CharacterAssetDefinition } from './types';

const character: CharacterAssetDefinition = {
  base: 'assets/character.webp',
  defaultFraming: 'full',
  framings: {
    full: { scale: 1 },
    bust: { scale: 1.55, x: 2, y: -3 },
  },
};

describe('character framing presets', () => {
  it('resolves a calibrated framing from one original image', () => {
    expect(resolveCharacterFraming(character, 'bust')).toEqual({
      name: 'bust',
      scale: 1.55,
      x: 2,
      y: -3,
    });
  });

  it('uses the authored default and safely falls back for legacy characters', () => {
    expect(resolveCharacterFraming(character)).toEqual({
      name: 'full',
      scale: 1,
      x: 0,
      y: 0,
    });
    expect(resolveCharacterFraming({ base: 'assets/legacy.webp' })).toEqual({
      name: 'full',
      scale: 1,
      x: 0,
      y: 0,
    });
  });
});
