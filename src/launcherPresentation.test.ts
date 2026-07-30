import { describe, expect, it } from 'vitest';
import { buildLauncherShowcaseStyle, normalizeLauncherShowcase } from './launcherPresentation';

describe('launcher showcase presentation', () => {
  it('normalizes generic launcher metadata without inspecting game tags or ids', () => {
    const showcase = normalizeLauncherShowcase({
      label: '  ENGINE SHOWCASE  ',
      backgroundColor: '#171b24',
      image: {
        positionX: 38,
        positionY: 35,
        scale: 1.08,
        offsetX: 18,
      },
    });

    expect(showcase).toEqual({
      label: 'ENGINE SHOWCASE',
      backgroundColor: '#171b24',
      image: {
        positionX: 38,
        positionY: 35,
        scale: 1.08,
        offsetX: 18,
        offsetY: undefined,
      },
    });
    expect(buildLauncherShowcaseStyle(showcase)).toEqual({
      '--launcher-showcase-background': '#171b24',
      '--launcher-showcase-position-x': '38%',
      '--launcher-showcase-position-y': '35%',
      '--launcher-showcase-scale': '1.08',
      '--launcher-showcase-offset-x': '18%',
    });
  });

  it('clamps numeric input and rejects unsafe color values', () => {
    expect(
      normalizeLauncherShowcase({
        backgroundColor: '#12345',
        image: {
          positionX: -20,
          positionY: 140,
          scale: 9,
          offsetX: -80,
          offsetY: 90,
        },
      }),
    ).toEqual({
      label: undefined,
      backgroundColor: undefined,
      image: {
        positionX: 0,
        positionY: 100,
        scale: 2,
        offsetX: -50,
        offsetY: 50,
      },
    });
  });

  it('returns undefined when no supported presentation value exists', () => {
    expect(normalizeLauncherShowcase({ image: { scale: 'large' } })).toBeUndefined();
    expect(buildLauncherShowcaseStyle(undefined)).toBeUndefined();
  });
});
