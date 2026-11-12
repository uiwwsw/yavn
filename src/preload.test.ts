import { describe, expect, it } from 'vitest';
import { collectChapterAssetPaths, collectStartupAssetPaths } from './preload';
import type { GameData } from './types';

const game = {
  meta: { title: 'Preload Test' },
  settings: { textSpeed: 38, autoSave: true, clickToInstant: true },
  assets: {
    backgrounds: {
      opening: '/bg/opening.png',
      branch: '/bg/branch.png',
      unused: '/bg/unused.png',
      clue: '/items/clue.svg',
    },
    characters: {
      A: {
        base: '/char/a/base.png',
        emotions: { focused: '/char/a/focused.png' },
      },
      B: {
        base: '/char/b/base.png',
      },
    },
    music: {
      theme: '/music/theme.mp3',
      unused: '/music/unused.mp3',
    },
    sfx: {
      click: '/sfx/click.wav',
      unused: '/sfx/unused.wav',
    },
  },
  inventory: {
    defaults: {
      clue: {
        name: 'Clue',
        image: '/items/clue.svg',
      },
      unused: {
        name: 'Unused',
        image: '/items/unused.svg',
      },
    },
  },
  script: [{ scene: 'opening' }, { scene: 'branch' }],
  scenes: {
    opening: {
      actions: [
        { bg: 'opening' },
        { char: { id: 'A', position: 'center' as const } },
        { say: { char: 'A.focused', with: ['B'], text: 'Ready' } },
        { music: 'theme' },
        { sound: 'click' },
      ],
    },
    branch: {
      actions: [
        { sticker: { id: 'clue', image: 'clue' } },
        { get: 'clue' },
        { video: { src: '/video/scene.mp4' } },
        { video: { src: 'https://www.youtube.com/watch?v=abc123' } },
      ],
    },
  },
} satisfies GameData;

describe('collectChapterAssetPaths', () => {
  it('keeps first-scene visual assets first and excludes unused or streamed declarations', () => {
    expect(collectChapterAssetPaths(game)).toEqual([
      '/bg/opening.png',
      '/char/a/base.png',
      '/char/a/focused.png',
      '/char/b/base.png',
      '/items/clue.svg',
    ]);
  });
});

describe('collectStartupAssetPaths', () => {
  it('limits a fresh start to the first scripted scene', () => {
    expect(collectStartupAssetPaths(game)).toEqual([
      '/bg/opening.png',
      '/char/a/base.png',
      '/char/a/focused.png',
      '/char/b/base.png',
    ]);
  });

  it('keeps the background in effect before a resume point and the rest of that scene', () => {
    expect(collectStartupAssetPaths(game, 'opening', 2)).toEqual([
      '/bg/opening.png',
      '/char/a/focused.png',
      '/char/b/base.png',
    ]);
    expect(collectStartupAssetPaths(game, 'branch', 1)).toEqual(['/items/clue.svg']);
  });

  it('includes scenes one goto or choice away from the start position', () => {
    const branching = {
      ...game,
      scenes: {
        ...game.scenes,
        opening: {
          actions: [
            { bg: 'opening' },
            { choice: { key: 'pick', prompt: 'Pick', options: [{ text: 'Go', goto: 'branch' }] } },
          ],
        },
      },
    } satisfies GameData;
    expect(collectStartupAssetPaths(branching)).toEqual(['/bg/opening.png', '/items/clue.svg']);
  });

  it('falls back to the first scripted scene when the resume scene is unknown', () => {
    expect(collectStartupAssetPaths(game, 'missing', 3)).toEqual(collectStartupAssetPaths(game));
  });
});
