import { describe, expect, it } from 'vitest';
import { gameContentPath, gameReaderPath, parseGameRoute } from './gameRoute';
import { parseGameIdFromPath, resolveInitialBootPresentation } from './bootPresentation';
import { readGameIdFromPath } from './updateCheck';

describe('parseGameRoute', () => {
  it('reads the same game from either interface language', () => {
    expect(parseGameRoute('/game-list/360/')).toEqual({ id: '360', uiLanguage: 'ko' });
    expect(parseGameRoute('/en/game-list/360/')).toEqual({ id: '360', uiLanguage: 'en' });
  });

  it('accepts the address with or without its trailing slash', () => {
    expect(parseGameRoute('/en/game-list/360')?.id).toBe('360');
    expect(parseGameRoute('/game-list/360')?.id).toBe('360');
  });

  it('decodes an escaped id', () => {
    expect(parseGameRoute('/en/game-list/8bit%2Dheart/')?.id).toBe('8bit-heart');
  });

  it('is not an address for anything deeper, or for another /en page', () => {
    expect(parseGameRoute('/game-list/360/assets/bg/title.svg')).toBeUndefined();
    expect(parseGameRoute('/en/create/')).toBeUndefined();
    expect(parseGameRoute('/en/')).toBeUndefined();
    expect(parseGameRoute('/')).toBeUndefined();
  });
});

describe('the addresses a game is served and fetched from', () => {
  it('fetches from one address whatever the reader sees', () => {
    expect(gameContentPath('360')).toBe('/game-list/360/');
    expect(gameReaderPath(gameContentPath('360'), 'ko')).toBe('/game-list/360/');
    expect(gameReaderPath(gameContentPath('360'), 'en')).toBe('/en/game-list/360/');
  });
});

describe('everything that keys off the address agrees', () => {
  it('boots straight into the game from either language', () => {
    for (const path of ['/game-list/360/', '/en/game-list/360/']) {
      expect(resolveInitialBootPresentation(path)).toEqual({ bootMode: 'gameList', gameBootPending: true });
      expect(parseGameIdFromPath(path)).toBe('360');
      expect(readGameIdFromPath(path)).toBe('360');
    }
  });

  it('still opens the launcher for the English library', () => {
    expect(resolveInitialBootPresentation('/en/')).toEqual({ bootMode: 'launcher', gameBootPending: false });
  });
});
