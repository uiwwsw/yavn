import { describe, expect, it } from 'vitest';
import {
  parseGameIdFromPath,
  resolveInitialBootPresentation,
  shouldShowGameRouteBoot,
} from './bootPresentation';

describe('initial boot presentation', () => {
  it('holds direct game routes behind a non-interactive boot surface', () => {
    expect(resolveInitialBootPresentation('/game-list/deokman-v8-preview')).toEqual({
      bootMode: 'gameList',
      gameBootPending: true,
    });
    expect(resolveInitialBootPresentation('/game-list/conan-demo/')).toEqual({
      bootMode: 'gameList',
      gameBootPending: true,
    });
  });

  it('keeps the launcher immediately available on non-game routes', () => {
    expect(resolveInitialBootPresentation('/')).toEqual({
      bootMode: 'launcher',
      gameBootPending: false,
    });
    expect(resolveInitialBootPresentation('/docs/guide')).toEqual({
      bootMode: 'launcher',
      gameBootPending: false,
    });
  });

  it('decodes the game id used for start gate session scoping', () => {
    expect(parseGameIdFromPath('/game-list/%EB%8D%95%EB%A7%8C')).toBe('덕만');
    expect(parseGameIdFromPath('/game-list/deokman-v8-preview/0.yaml')).toBeUndefined();
  });

  it('releases the route boot surface as soon as game data can mount its assets', () => {
    expect(shouldShowGameRouteBoot(true, false)).toBe(true);
    expect(shouldShowGameRouteBoot(true, true)).toBe(false);
    expect(shouldShowGameRouteBoot(false, false)).toBe(false);
  });
});
