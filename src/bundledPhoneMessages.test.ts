import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import type { GameData, SayAction } from './types';

const root = resolve('public/game-list');
const chapters = readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .flatMap(entry => readdirSync(resolve(root, entry.name))
    .filter(file => /^\d+\.yaml$/.test(file))
    .map(file => ({ game: entry.name, file })));

describe('bundled phone messages', () => {
  it.each(chapters)('$game/$file separates contacts and room titles from message text', ({ game, file }) => {
    const chapter = load(readFileSync(resolve(root, game, file), 'utf8')) as GameData;
    const base = load(readFileSync(resolve(root, game, 'base.yaml'), 'utf8')) as GameData;
    for (const [sceneId, scene] of Object.entries(chapter.scenes)) {
      for (const action of scene.actions) {
        if (!('say' in action) || action.say.channel !== 'message') continue;
        const say: SayAction['say'] = action.say;
        const location = `${game}/${file}/${sceneId}: ${say.text}`;
        expect(say.thread, location).toBeTruthy();
        if (say.side !== 'me') {
          expect(say.char || say.speakerName, location).toBeTruthy();
        }
        const characterId = say.char?.split('.')[0];
        if (characterId) {
          const character = base.assets.characters[characterId];
          expect(character, location).toBeTruthy();
          // These are transparent stage placeholders, not contact pictures.
          if (/(?:self|voice)\.svg$/.test(character.base)) {
            expect(character.avatar, location).toBeTruthy();
          }
          if (character.avatar) {
            expect(existsSync(resolve(root, game, character.avatar)), location).toBe(true);
          }
        }
        const names = [say.speakerName, characterId, say.thread,
          characterId ? base.assets.characters[characterId]?.name : undefined].filter(Boolean);
        for (const name of names) {
          expect(say.text?.startsWith(`${name}:`), location).not.toBe(true);
          expect(say.text?.startsWith(`${name}：`), location).not.toBe(true);
        }
        expect(say.text, location).not.toMatch(/^\[(?:영업2팀|ERASE 클리닉)\]/);
      }
    }
  });
});
