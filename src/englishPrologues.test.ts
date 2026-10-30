import { readFileSync, existsSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

type Tree = Record<string, any>;
const source = (game: string, file: string) => readFileSync(new URL(`../public/game-list/${game}/${file}`, import.meta.url), 'utf8');
const yaml = (game: string, file: string) => load(source(game, file)) as Tree;
const fields = new Set(['text', 'prompt', 'title', 'chapterTitle', 'continueLabel', 'caption', 'message']);
function values(value: any, predicate: (key: string) => boolean): string[] {
  if (Array.isArray(value)) return value.flatMap(item => values(item, predicate));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => typeof item === 'string' && predicate(key) ? [item] : values(item, predicate));
}
function choices(document: Tree) {
  return Object.fromEntries(Object.entries(document.scenes).flatMap(([id, scene]: [string, any]) => scene.actions.filter((action: any) => action.choice).map((action: any) => [id, {
    key: action.choice.key, timeoutMs: action.choice.timeoutMs, timeoutOptionIndex: action.choice.timeoutOptionIndex,
    options: action.choice.options.map(({ text, ...logic }: any) => logic),
  }])));
}
describe.each(['conan', 'deokman'])('English opening: %s', game => {
  const id = `english-${game}`;
  it('parses and resolves with the original art, named speakers and all English reading text', () => {
    const config = parseConfigYaml(source(id, 'config.yaml'), `${id}/config.yaml`);
    const base = parseBaseYaml(source(id, 'base.yaml'), `${id}/base.yaml`);
    const chapter = parseChapterYaml(source(id, '0.yaml'), `${id}/0.yaml`);
    expect(config.error).toBeUndefined(); expect(base.error).toBeUndefined(); expect(chapter.error).toBeUndefined();
    const result = resolveChapterGame({ config: config.data!, bases: [base.data!], chapter: chapter.data! });
    expect(result.error).toBeUndefined();
    const allText = values(yaml(id, '0.yaml'), key => fields.has(key));
    expect(allText.length).toBeGreaterThan(100);
    expect(allText.some(text => /[가-힣]/.test(text))).toBe(false);
    expect(Object.keys(result.data!.assets.characters).some(name => /[가-힣]/.test(name))).toBe(false);
    for (const file of ['config.yaml', 'base.yaml', '0.yaml']) {
      for (const path of values(yaml(id, file), () => true).filter(value => value.startsWith('root:/'))) {
        expect(existsSync(new URL(`../public/${path.slice(6)}`, import.meta.url)), path).toBe(true);
      }
    }
  });
  it('preserves every choice, condition, reward, deadline and performance cue', () => {
    const ko = yaml(game, '0.yaml'); const en = yaml(id, '0.yaml');
    expect(Object.keys(en.scenes)).toEqual(Object.keys(ko.scenes));
    expect(en.script).toEqual(ko.script);
    expect(choices(en)).toEqual(choices(ko));
    for (const [sceneId, scene] of Object.entries(ko.scenes) as [string, any][]) {
      const original = scene.actions.filter((action: any) => action.say).map((action: any) => action.say);
      const localized = en.scenes[sceneId].actions.filter((action: any) => action.say).map((action: any) => action.say);
      expect(localized.length).toBe(original.length);
      original.forEach((say: any, i: number) => {
        for (const field of ['delivery', 'channel', 'wait', 'unskippable', 'camera']) expect(localized[i][field]).toEqual(say[field]);
        expect(localized[i].text.match(/<\/?speed(?:=\d+)?>/g)).toEqual(say.text.match(/<\/?speed(?:=\d+)?>/g));
      });
    }
  });
  it('labels its limited scope and stops before the untranslated next chapter', () => {
    const config = yaml(id, 'config.yaml'); const launcher = yaml(id, 'launcher.yaml');
    expect(launcher.languages).toEqual(['en']);
    expect(launcher.summary).toMatch(/chapter (one )?only/);
    expect(config.defaultEnding).toBe('prologue_end');
    expect(config.endings.prologue_end.message).toContain('Korean');
    expect(values(yaml(id, '0.yaml'), key => key === 'goto').some(path => path.includes('.yaml'))).toBe(false);
  });
});
