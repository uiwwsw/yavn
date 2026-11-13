import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/muwon/', import.meta.url));
const chapterPaths = Array.from({ length: 5 }, (_, index) => `${index}.yaml`);

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const readSource = (path: string): string => readFileSync(`${gameRoot}${path}`, 'utf8');
const readYaml = (path: string): UnknownRecord => load(readSource(path)) as UnknownRecord;

const collectKey = (value: unknown, key: string, result: unknown[] = []): unknown[] => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKey(entry, key, result));
    return result;
  }
  const record = asRecord(value);
  if (Object.prototype.hasOwnProperty.call(record, key)) result.push(record[key]);
  Object.values(record).forEach((entry) => collectKey(entry, key, result));
  return result;
};

const config = parseConfigYaml(readSource('config.yaml'), 'muwon/config.yaml');
const base = parseBaseYaml(readSource('base.yaml'), 'muwon/base.yaml');
const chapters = chapterPaths.map((path) => readYaml(path));

describe('무원 — 한성 검안록', () => {
  it('resolves all five chapters through the production schema', () => {
    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    chapterPaths.forEach((path) => {
      const chapter = parseChapterYaml(readSource(path), `muwon/${path}`);
      expect(chapter.error, path).toBeUndefined();
      const resolved = resolveChapterGame({ config: config.data!, bases: [base.data!], chapter: chapter.data! });
      expect(resolved.error, path).toBeUndefined();
    });
  });

  it('ships every referenced asset as an original file in the game folder', () => {
    const declared = [
      ...Object.values(asRecord(asRecord(readYaml('base.yaml').assets).backgrounds)),
      ...Object.values(asRecord(asRecord(readYaml('base.yaml').assets).music)),
      ...collectKey(readYaml('base.yaml'), 'base'),
      ...collectKey(asRecord(asRecord(readYaml('base.yaml').assets).characters), 'emotions').flatMap((entry) => Object.values(asRecord(entry))),
      ...collectKey(readYaml('base.yaml').inventory, 'image'),
    ].map(String);
    expect(declared.length).toBeGreaterThan(40);
    declared.forEach((path) => {
      expect(path.startsWith('assets/'), path).toBe(true);
      expect(existsSync(`${gameRoot}${path}`), path).toBe(true);
    });
  });

  it('lets every failure return to the choice that caused it', () => {
    const choiceKeys = new Set(chapters.flatMap((chapter) => collectKey(chapter, 'choice').map((choice) => String(asRecord(choice).key))));
    const failures = chapters.flatMap((chapter) => collectKey(chapter, 'gameOver')).map(asRecord);
    expect(failures.length).toBeGreaterThanOrEqual(4);
    failures.forEach((failure) => {
      expect(failure.title, JSON.stringify(failure)).toBeTruthy();
      expect(choiceKeys.has(String(failure.recoverToChoice)), String(failure.recoverToChoice)).toBe(true);
    });
  });

  it('reaches all four endings from the story', () => {
    const declared = Object.keys(asRecord(readYaml('config.yaml').endings));
    const used = new Set(chapters.flatMap((chapter) => collectKey(chapter, 'ending')).map(String));
    expect(declared.sort()).toEqual(['covered_ledger', 'late_muwon', 'muwon', 'price_of_silence']);
    declared.forEach((ending) => expect(used.has(ending), ending).toBe(true));
  });

  it('keeps lines short enough for the dialogue box', () => {
    const lines = chapters.flatMap((chapter) => collectKey(chapter, 'say')).map((say) => String(asRecord(say).text));
    expect(lines.length).toBeGreaterThan(250);
    lines.forEach((line) => expect(line.length, line).toBeLessThanOrEqual(80));
    const prompts = chapters.flatMap((chapter) => collectKey(chapter, 'choice')).map((choice) => String(asRecord(choice).prompt));
    prompts.forEach((prompt) => expect(prompt.length, prompt).toBeLessThanOrEqual(50));
  });

  it('declares every character and item it stages', () => {
    const characters = Object.keys(asRecord(asRecord(readYaml('base.yaml').assets).characters));
    const items = Object.keys(asRecord(readYaml('base.yaml').inventory));
    const staged = chapters.flatMap((chapter) => [
      ...collectKey(chapter, 'char').filter((value) => typeof value === 'string').map((value) => String(value).split('.')[0]),
      ...collectKey(chapter, 'with').flatMap((value) => (Array.isArray(value) ? value.map(String) : [])),
    ]);
    staged.forEach((name) => expect(characters, name).toContain(name));
    chapters.flatMap((chapter) => collectKey(chapter, 'get')).forEach((item) => expect(items, String(item)).toContain(String(item)));
    expect(new Set(chapters.flatMap((chapter) => collectKey(chapter, 'get')).map(String)).size).toBe(items.length);
  });
});
