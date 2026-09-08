import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import type { Action } from './types';

const root = resolve('public/game-list');
const source = (game: string, file: string) => readFileSync(resolve(root, game, file), 'utf8');
const record = (value: unknown): Record<string, any> => value as Record<string, any>;

describe('bundled game presentation', () => {
  it.each([['conan-demo', '0.yaml'], ['live2dtest', '1.yaml']])(
    '%s stages every speaking actor along both choices and returning demo loops', (game, file) => {
      const config = parseConfigYaml(source(game, 'config.yaml'), `${game}/config.yaml`);
      const base = parseBaseYaml(source(game, 'base.yaml'), `${game}/base.yaml`);
      const chapter = parseChapterYaml(source(game, file), `${game}/${file}`);
      expect(config.error ?? base.error ?? chapter.error).toBeUndefined();
      if (!config.data || !base.data || !chapter.data) throw new Error('Invalid demo');
      const resolved = resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data });
      expect(resolved.error).toBeUndefined();
      const data = resolved.data!;
      const order = data.script.map((entry) => entry.scene);
      const queue = [{ scene: order[0], index: 0, slots: {} as Record<string, string> }];
      const seen = new Set<string>();
      const endings = new Set<string>();
      while (queue.length) {
        const current = queue.shift()!;
        const signature = `${current.scene}:${current.index}:${JSON.stringify(current.slots)}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        const actions = data.scenes[current.scene]?.actions;
        expect(actions, current.scene).toBeDefined();
        const action: Action | undefined = actions?.[current.index];
        const enqueue = (scene: string, index = 0, slots = current.slots) => queue.push({ scene, index, slots });
        if (!action) {
          const next = order[order.indexOf(current.scene) + 1];
          if (next) enqueue(next);
          continue;
        }
        if ('char' in action) {
          const slots = Object.fromEntries(Object.entries(current.slots).filter(([, id]) => id !== action.char.id));
          slots[action.char.position] = action.char.id;
          enqueue(current.scene, current.index + 1, slots);
          continue;
        }
        const prompt = 'say' in action ? action.say : 'choice' in action ? action.choice : undefined;
        for (const ref of [prompt?.char, ...(prompt?.with ?? [])]) {
          if (ref) expect(Object.values(current.slots), `${game}/${current.scene}[${current.index}]: ${ref}`)
            .toContain(ref.split('.')[0]);
        }
        if ('ending' in action) { endings.add(action.ending); continue; }
        if ('goto' in action) { enqueue(action.goto); continue; }
        if ('choice' in action) {
          action.choice.options.forEach((option) => option.goto
            ? enqueue(option.goto) : enqueue(current.scene, current.index + 1));
          continue;
        }
        enqueue(current.scene, current.index + 1);
      }
      expect(endings.size).toBeGreaterThan(0);
    },
  );

  it('gives both main games complete ending presentations and playable local scores', () => {
    for (const game of ['conan', 'deokman']) {
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
    const music = record(load(source('deokman', 'base.yaml'))).assets.music;
    for (let chapter = 0; chapter < 12; chapter += 1) {
      const data = record(load(source('deokman', `${chapter}.yaml`)));
      const actions = Object.values(data.scenes).flatMap((scene) => record(scene).actions);
      const cues = actions.filter((action) => action.music).map((action) => action.music);
      expect(cues.length, `chapter ${chapter + 1}`).toBeGreaterThan(0);
      cues.forEach((cue) => expect(music[cue], cue).toBeTruthy());
    }
  });
});
