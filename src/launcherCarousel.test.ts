import { describe, expect, it } from 'vitest';
import {
  buildLauncherDemoHash,
  parseLauncherDemoHash,
  resolveInitialCarouselGameId,
  wrapCarouselIndex,
} from './launcherCarousel';

describe('launcher carousel', () => {
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

  it('uses the current selection, direct link, then first game in that order', () => {
    const gameIds = ['deokman', 'conan', 'live2dtest'];
    expect(resolveInitialCarouselGameId(gameIds, 'conan', '#demo=deokman')).toBe('conan');
    expect(resolveInitialCarouselGameId(gameIds, null, '#demo=conan')).toBe('conan');
    expect(resolveInitialCarouselGameId(gameIds, null, '#demo=missing')).toBe('deokman');
    expect(resolveInitialCarouselGameId([], null, '')).toBeNull();
  });
});
