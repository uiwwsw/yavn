import { describe, expect, it } from 'vitest';
import {
  buildLauncherDemoHash,
  parseLauncherDemoHash,
  pickRandomCarouselIndex,
  wrapCarouselIndex,
} from './launcherCarousel';

describe('launcher carousel', () => {
  it('selects a stable random index within the available demo count', () => {
    expect(pickRandomCarouselIndex(3, 0)).toBe(0);
    expect(pickRandomCarouselIndex(3, 0.5)).toBe(1);
    expect(pickRandomCarouselIndex(3, 0.999999)).toBe(2);
  });

  it('guards invalid random values and empty collections', () => {
    expect(pickRandomCarouselIndex(3, Number.NaN)).toBe(0);
    expect(pickRandomCarouselIndex(0, 0.5)).toBe(-1);
  });

  it('wraps previous and next navigation at both ends', () => {
    expect(wrapCarouselIndex(-1, 3)).toBe(2);
    expect(wrapCarouselIndex(3, 3)).toBe(0);
    expect(wrapCarouselIndex(1, 3)).toBe(1);
    expect(wrapCarouselIndex(2, 0)).toBe(-1);
  });

  it('round-trips the selected demo through the launcher hash', () => {
    expect(buildLauncherDemoHash('conan demo')).toBe('#demo=conan%20demo');
    expect(parseLauncherDemoHash('#demo=conan%20demo')).toBe('conan demo');
    expect(parseLauncherDemoHash('#other=value')).toBeNull();
  });
});
