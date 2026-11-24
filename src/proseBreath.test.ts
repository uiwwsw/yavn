import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The author's voice does not get to name the feeling. A character may say 무섭다 out loud —
// that is them talking — but narration, thought and action have to put it in a body, an object
// or a number instead. Naming it is the tell that gives writing away as machine-made, and it
// reads as instruction rather than as a scene.
const NAMED_FEELINGS = [
  '아련', '사무치', '그립다', '그리운', '가슴 한쪽', '가슴이 아려', '먹먹',
  '벅차올', '슬프다', '외롭다', '서글프', '참담하',
];
const AUTHOR_CHANNELS = new Set(['narration', 'thought', 'action']);

const listRoot = fileURLToPath(new URL('../public/game-list/', import.meta.url));
// Every folder under game-list that has chapters in it, fixtures included: a demo's lines are
// written by the same hand and read by the same people.
const games = readdirSync(listRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => readdirSync(`${listRoot}${name}`).some((file) => /^\d+\.yaml$/.test(file)));

// A say's channel can sit on the same line or a few lines above it in the block form, so read
// back a little and take the nearest one. No channel at all means dialogue, which is exempt.
const authorLines = (game: string): Array<{ where: string; text: string }> => {
  const out: Array<{ where: string; text: string }> = [];
  for (const file of readdirSync(`${listRoot}${game}`).filter((name) => name.endsWith('.yaml'))) {
    const source = readFileSync(`${listRoot}${game}/${file}`, 'utf8').split('\n');
    source.forEach((line, index) => {
      const said = /text:\s*"((?:[^"\\]|\\.)*)"/.exec(line);
      if (!said) return;
      const nearby = source.slice(Math.max(0, index - 5), index + 1).join('\n');
      const channels = [...nearby.matchAll(/channel:\s*(\w+)/g)].map((match) => match[1]);
      const channel = channels.at(-1) ?? 'dialogue';
      if (AUTHOR_CHANNELS.has(channel)) out.push({ where: `${game}/${file}:${index + 1}`, text: said[1] });
    });
  }
  return out;
};

describe('prose', () => {
  it('reads the author voice out of every published work', () => {
    // A demo can be all dialogue; a story cannot. Every published work has a narrator.
    const narrated = games.filter((game) => authorLines(game).length > 0);
    expect(narrated, narrated.join(', ')).toEqual(games);
  });

  it('never has the narrator name the feeling', () => {
    const named = games.flatMap((game) =>
      authorLines(game).flatMap(({ where, text }) =>
        NAMED_FEELINGS.filter((word) => text.includes(word)).map((word) => `${where} "${word}" — ${text}`)));
    expect(named, named.join('\n')).toEqual([]);
  });
});
