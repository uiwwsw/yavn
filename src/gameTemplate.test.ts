import { readFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

const template = resolve('examples/game-template');
const source = (name: string) => readFileSync(join(template, name), 'utf8');

describe('contributor game starter', () => {
  it('resolves without external assets and both choices lead to a declared ending', () => {
    const config = parseConfigYaml(source('config.yaml'), 'config.yaml');
    const base = parseBaseYaml(source('base.yaml'), 'base.yaml');
    const chapter = parseChapterYaml(source('0.yaml'), '0.yaml');
    expect(config.error ?? base.error ?? chapter.error).toBeUndefined();
    if (!config.data || !base.data || !chapter.data) throw new Error('Invalid starter package');
    const result = resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data });
    expect(result.error).toBeUndefined();
    if (!result.data) throw new Error('Unresolved starter');
    const game = result.data;
    const opening = game.scenes[game.script[0].scene].actions;
    const choice = opening.find(action => 'choice' in action);
    if (!choice || !('choice' in choice)) throw new Error('Starter needs a choice');
    expect(choice.choice.options).toHaveLength(2);
    for (const option of choice.choice.options) {
      if (!option.goto) throw new Error('Starter choice needs a destination');
      const actions = game.scenes[option.goto].actions;
      const ending = actions.find(action => 'ending' in action);
      if (!ending || !('ending' in ending)) throw new Error('Starter route needs an ending');
      expect(config.data.data.endings?.[ending.ending]).toBeDefined();
    }
    expect(game.assets.backgrounds).toEqual({});
    expect(game.assets.characters).toEqual({});
  });

  it('registers a copied package through the real catalog generator', () => {
    const root = mkdtempSync(join(tmpdir(), 'yavn-starter-'));
    try {
      mkdirSync(join(root, 'public/game-list'), { recursive: true });
      cpSync(template, join(root, 'public/game-list/my-story'), { recursive: true });
      execFileSync(process.execPath, [resolve('scripts/generate-game-list-manifest.mjs')], { cwd: root });
      const manifest = JSON.parse(readFileSync(join(root, 'public/game-list/index.json'), 'utf8'));
      expect(manifest.games).toHaveLength(1);
      expect(manifest.games[0]).toMatchObject({
        id: 'my-story', name: '나의 첫 이야기', path: '/game-list/my-story/',
        chapterCount: 1, languages: ['ko'],
      });
      expect(readFileSync(join(root, 'public/sitemap.xml'), 'utf8')).toContain('/game-list/my-story/');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
