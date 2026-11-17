import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

// Every game in public/game-list has to survive the production schema, chapter by chapter.
// muwonGame.test.ts and threeSixtyGame.test.ts check their own game in detail; this one is the
// floor under all of them, so a typo in a scene id or a goto that points nowhere fails here
// instead of in a player's browser.
const games = ['360', '8bit-heart', 'erase', 'muwon', 'overflow', 'tutorial'];

const gameRoot = (id: string): string => fileURLToPath(new URL(`../public/game-list/${id}/`, import.meta.url));

// Collect every numbered chapter, including games with gaps or a nonzero starting chapter.
const chapterPaths = (id: string): string[] => {
  const root = gameRoot(id);
  const found: string[] = [];
  for (let index = 0; index < 20; index += 1) {
    try {
      readFileSync(`${root}${index}.yaml`, 'utf8');
      found.push(`${index}.yaml`);
    } catch {
      // No chapter with this number; keep looking.
    }
  }
  return found;
};

describe('published games resolve through the production schema', () => {
  games.forEach((id) => {
    it(id, () => {
      const root = gameRoot(id);
      const read = (path: string): string => readFileSync(`${root}${path}`, 'utf8');

      const config = parseConfigYaml(read('config.yaml'), `${id}/config.yaml`);
      expect(config.error, `${id}/config.yaml`).toBeUndefined();

      const base = parseBaseYaml(read('base.yaml'), `${id}/base.yaml`);
      expect(base.error, `${id}/base.yaml`).toBeUndefined();

      const chapters = chapterPaths(id);
      expect(chapters.length, `${id} has no numbered chapters`).toBeGreaterThan(0);

      chapters.forEach((path) => {
        const chapter = parseChapterYaml(read(path), `${id}/${path}`);
        expect(chapter.error, `${id}/${path} parse`).toBeUndefined();
        const resolved = resolveChapterGame({
          config: config.data!,
          bases: [base.data!],
          chapter: chapter.data!,
        });
        expect(resolved.error, `${id}/${path} resolve`).toBeUndefined();
      });
    });
  });
});
