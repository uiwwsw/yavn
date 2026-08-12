import { describe, expect, it } from 'vitest';
import {
  buildLauncherDemoSharePath,
  clearLauncherDemoSharePath,
  normalizeLauncherDemoLocationPath,
  parseLauncherDemoHash,
  parseLauncherDemoQuery,
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

  it('builds clean, shareable query links without mutating the URL hash', () => {
    expect(buildLauncherDemoSharePath('/', '', 'conan demo')).toBe('/?demo=conan+demo');
    expect(buildLauncherDemoSharePath('/', '?lang=ko&demo=old', 'deokman')).toBe('/?lang=ko&demo=deokman');
    expect(clearLauncherDemoSharePath('/', '?lang=ko&demo=deokman')).toBe('/?lang=ko');
    expect(clearLauncherDemoSharePath('/', '?demo=deokman')).toBe('/');
    expect(parseLauncherDemoQuery('?demo=conan%20demo')).toBe('conan demo');
    expect(parseLauncherDemoQuery('?other=value')).toBeNull();
  });

  it('keeps parsing legacy demo hashes for one-time migration', () => {
    expect(parseLauncherDemoHash('#demo=conan%20demo')).toBe('conan demo');
    expect(parseLauncherDemoHash('#other=value')).toBeNull();
  });

  it('normalizes invalid queries and migrates only valid legacy selections', () => {
    const gameIds = ['deokman', 'conan'];
    expect(normalizeLauncherDemoLocationPath('/', '?demo=missing&lang=ko', '#library', gameIds))
      .toBe('/?lang=ko#library');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=missing&lang=ko', '#demo=conan', gameIds))
      .toBe('/?lang=ko&demo=conan');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=deokman', '#demo=conan', gameIds))
      .toBe('/?demo=deokman');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=', '', gameIds)).toBe('/');
    expect(normalizeLauncherDemoLocationPath('/', '', '#demo=missing', gameIds)).toBe('/');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=conan', '', gameIds)).toBeNull();
    expect(normalizeLauncherDemoLocationPath('/', '', '#library', gameIds)).toBeNull();
  });

  it('resolves explicit, current, and first-game selections without restoring a prior visit', () => {
    const gameIds = ['deokman', 'conan', 'live2dtest'];
    expect(resolveInitialCarouselGameId(gameIds, 'conan', '?demo=deokman', '')).toBe('deokman');
    expect(resolveInitialCarouselGameId(gameIds, null, '?demo=conan', '#demo=deokman')).toBe('conan');
    expect(resolveInitialCarouselGameId(gameIds, null, '', '#demo=conan')).toBe('conan');
    expect(resolveInitialCarouselGameId(gameIds, 'conan', '', '')).toBe('conan');
    expect(resolveInitialCarouselGameId(gameIds, null, '', '')).toBe('deokman');
    expect(resolveInitialCarouselGameId(gameIds, null, '?demo=missing', '')).toBe('deokman');
    expect(resolveInitialCarouselGameId([], null, '', '')).toBeNull();
  });
});
