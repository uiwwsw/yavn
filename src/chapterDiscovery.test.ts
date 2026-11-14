import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { resolveDeclaredChapterNumbers } from './chapterDiscovery';

const gameListDir = new URL('../public/game-list/', import.meta.url);

describe('resolveDeclaredChapterNumbers', () => {
  it('numbers a zero-based game from its first file', () => {
    expect(resolveDeclaredChapterNumbers({ declaredCount: 5, startsAtZero: true })).toEqual([0, 1, 2, 3, 4]);
  });

  it('numbers a one-based game from its first file', () => {
    expect(resolveDeclaredChapterNumbers({ declaredCount: 3, startsAtZero: false })).toEqual([1, 2, 3]);
  });

  it('yields nothing for a count that cannot describe a game', () => {
    expect(resolveDeclaredChapterNumbers({ declaredCount: 0, startsAtZero: true })).toEqual([]);
    expect(resolveDeclaredChapterNumbers({ declaredCount: -2, startsAtZero: true })).toEqual([]);
    expect(resolveDeclaredChapterNumbers({ declaredCount: 2.5, startsAtZero: true })).toEqual([]);
  });
});

describe('shipped games', () => {
  const games = readdirSync(gameListDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it.each(games)('%s declares the number of chapter files it ships', (game) => {
    const dir = new URL(`${game}/`, gameListDir);
    const onDisk = readdirSync(dir).filter((name) => /^\d+\.yaml$/.test(name)).length;
    const config = load(readFileSync(new URL('config.yaml', dir), 'utf8')) as { chapters?: number };

    // Without this the loader has to probe past the last chapter to find the end, and every
    // miss is a 404 in the player's console.
    expect(config.chapters, `${game}/config.yaml is missing 'chapters'`).toBe(onDisk);
  });
});
