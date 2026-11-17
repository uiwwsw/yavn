import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const root = resolve('public/game-list');
const source = (game: string, file: string) => readFileSync(resolve(root, game, file), 'utf8');
const record = (value: unknown): Record<string, any> => value as Record<string, any>;

describe('bundled game presentation', () => {
  it('gives the main game complete ending presentations and playable local scores', () => {
    for (const game of ['muwon']) {
      const config = record(load(source(game, 'config.yaml')));
      const assets = record(load(source(game, 'base.yaml'))).assets;
      for (const ending of Object.values(config.endings).map(record)) {
        expect(ending.epilogue.length).toBeGreaterThan(10);
        expect(assets.backgrounds[ending.background]).toBeTruthy();
        const path = assets.music[ending.music] as string;
        expect(path).toBeTruthy();
        const local = path.startsWith('root:/') ? resolve('public', path.slice(6))
          : resolve(root, game, path.replace(/^\//, ''));
        expect(existsSync(local), local).toBe(true);
      }
    }
    const music = record(load(source('muwon', 'base.yaml'))).assets.music;
    for (let chapter = 0; chapter < 5; chapter += 1) {
      const data = record(load(source('muwon', `${chapter}.yaml`)));
      const actions = Object.values(data.scenes).flatMap((scene) => record(scene).actions);
      const cues = actions.filter((action) => action.music).map((action) => action.music);
      expect(cues.length, `chapter ${chapter + 1}`).toBeGreaterThan(0);
      cues.forEach((cue) => expect(music[cue], cue).toBeTruthy());
    }
  });
});
