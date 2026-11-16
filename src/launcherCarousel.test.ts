import { describe, expect, it, vi } from 'vitest';
import {
  buildLauncherDemoSharePath,
  clearLauncherDemoSharePath,
  normalizeLauncherDemoLocationPath,
  parseLauncherDemoHash,
  parseLauncherDemoQuery,
  resolveInitialCarouselGameId,
  shuffleCarouselGames,
  wrapCarouselIndex,
} from './launcherCarousel';

describe('launcher carousel', () => {
  it('shuffles the spotlight without reordering the library or overriding a shared demo', () => {
    const gameIds = ['360', '8bit-heart', 'muwon'];
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const carouselGameIds = shuffleCarouselGames(gameIds);
      expect(carouselGameIds).toEqual(['8bit-heart', 'muwon', '360']);
      expect(gameIds).toEqual(['360', '8bit-heart', 'muwon']);
      expect(resolveInitialCarouselGameId(carouselGameIds, null, '', '')).toBe('8bit-heart');
      expect(resolveInitialCarouselGameId(carouselGameIds, null, '?demo=360', '')).toBe('360');
    } finally {
      random.mockRestore();
    }
  });

  it('wraps previous and next navigation at both ends', () => {
    expect(wrapCarouselIndex(-1, 3)).toBe(2);
    expect(wrapCarouselIndex(3, 3)).toBe(0);
    expect(wrapCarouselIndex(1, 3)).toBe(1);
    expect(wrapCarouselIndex(2, 0)).toBe(-1);
  });

  it('builds clean, shareable query links without mutating the URL hash', () => {
    expect(buildLauncherDemoSharePath('/', '', 'mystery demo')).toBe('/?demo=mystery+demo');
    expect(buildLauncherDemoSharePath('/', '?lang=ko&demo=old', 'deokman')).toBe('/?lang=ko&demo=deokman');
    expect(clearLauncherDemoSharePath('/', '?lang=ko&demo=deokman')).toBe('/?lang=ko');
    expect(clearLauncherDemoSharePath('/', '?demo=deokman')).toBe('/');
    expect(parseLauncherDemoQuery('?demo=mystery%20demo')).toBe('mystery demo');
    expect(parseLauncherDemoQuery('?other=value')).toBeNull();
  });

  it('keeps parsing legacy demo hashes for one-time migration', () => {
    expect(parseLauncherDemoHash('#demo=mystery%20demo')).toBe('mystery demo');
    expect(parseLauncherDemoHash('#other=value')).toBeNull();
  });

  it('normalizes invalid queries and migrates only valid legacy selections', () => {
    const gameIds = ['deokman', 'mystery'];
    expect(normalizeLauncherDemoLocationPath('/', '?demo=missing&lang=ko', '#library', gameIds))
      .toBe('/?lang=ko#library');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=missing&lang=ko', '#demo=mystery', gameIds))
      .toBe('/?lang=ko&demo=mystery');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=deokman', '#demo=mystery', gameIds))
      .toBe('/?demo=deokman');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=', '', gameIds)).toBe('/');
    expect(normalizeLauncherDemoLocationPath('/', '', '#demo=missing', gameIds)).toBe('/');
    expect(normalizeLauncherDemoLocationPath('/', '?demo=mystery', '', gameIds)).toBeNull();
    expect(normalizeLauncherDemoLocationPath('/', '', '#library', gameIds)).toBeNull();
  });

  it('resolves explicit, current, and first-game selections without restoring a prior visit', () => {
    const gameIds = ['deokman', 'mystery', 'live2dtest'];
    expect(resolveInitialCarouselGameId(gameIds, 'mystery', '?demo=deokman', '')).toBe('deokman');
    expect(resolveInitialCarouselGameId(gameIds, null, '?demo=mystery', '#demo=deokman')).toBe('mystery');
    expect(resolveInitialCarouselGameId(gameIds, null, '', '#demo=mystery')).toBe('mystery');
    expect(resolveInitialCarouselGameId(gameIds, 'mystery', '', '')).toBe('mystery');
    expect(resolveInitialCarouselGameId(gameIds, null, '', '')).toBe('deokman');
    expect(resolveInitialCarouselGameId(gameIds, null, '?demo=missing', '')).toBe('deokman');
    expect(resolveInitialCarouselGameId([], null, '', '')).toBeNull();
  });
});
