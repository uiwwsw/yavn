import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/360/', import.meta.url));
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

const config = parseConfigYaml(readSource('config.yaml'), '360/config.yaml');
const base = parseBaseYaml(readSource('base.yaml'), '360/base.yaml');
const chapters = chapterPaths.map((path) => readYaml(path));
const baseYaml = readYaml('base.yaml');
const assets = asRecord(baseYaml.assets);

// The four directions a life can be handed, and the one choice in that life each of them takes away.
// What a life takes is what the next life cannot do, whichever order the lives are lived in.
// Each life reads only `last_taken`, so exactly one of its two doors is shut at a time and the
// other always stays open. The first life of a run has nothing taken yet and is free.
const HOLDING = ['hold', 'say', 'guard', 'live'];
const LETTING = ['kin', 'free', 'stay', 'dare'];
const lifeGates: Array<{ chapter: number; choice: string; shut: string[]; open: string[] }> = [
  { chapter: 0, choice: 'l1_rice', shut: HOLDING, open: LETTING },
  { chapter: 0, choice: 'l1_leave', shut: LETTING, open: HOLDING },
  { chapter: 1, choice: 'l2_heart', shut: HOLDING, open: LETTING },
  { chapter: 1, choice: 'l2_mother', shut: LETTING, open: HOLDING },
  { chapter: 2, choice: 'l3_open', shut: HOLDING, open: LETTING },
  { chapter: 2, choice: 'l3_out', shut: LETTING, open: HOLDING },
  // The editing room is the one life where both directions lose the same choice, one door each.
  { chapter: 3, choice: 'l4_sign', shut: [...HOLDING, ...LETTING], open: [] },
];

describe('360', () => {
  it('resolves all five chapters through the production schema', () => {
    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    chapterPaths.forEach((path) => {
      const chapter = parseChapterYaml(readSource(path), `360/${path}`);
      expect(chapter.error, path).toBeUndefined();
      const resolved = resolveChapterGame({ config: config.data!, bases: [base.data!], chapter: chapter.data! });
      expect(resolved.error, path).toBeUndefined();
    });
  });

  it('ships every referenced asset as an original file in the game folder', () => {
    const declared = [
      ...Object.values(asRecord(assets.backgrounds)),
      ...Object.values(asRecord(assets.music)),
      ...collectKey(assets.characters, 'base'),
      ...collectKey(assets.characters, 'emotions').flatMap((entry) => Object.values(asRecord(entry))),
    ].map(String);
    expect(declared.length).toBeGreaterThan(30);
    declared.forEach((path) => {
      expect(path.startsWith('assets/'), path).toBe(true);
      expect(existsSync(`${gameRoot}${path}`), path).toBe(true);
    });
  });

  it('only names backgrounds, music, characters and expressions that base.yaml declares', () => {
    const backgrounds = asRecord(assets.backgrounds);
    const music = asRecord(assets.music);
    const characters = asRecord(assets.characters);
    chapters.forEach((chapter, index) => {
      collectKey(chapter, 'bg').forEach((bg) => {
        const id = typeof bg === 'string' ? bg : String(asRecord(bg).id);
        expect(backgrounds[id], `${index}.yaml bg ${id}`).toBeTruthy();
      });
      // `music: null` stops the track; it is not a cue to look up.
      collectKey(chapter, 'music').filter((cue) => cue !== null).forEach((cue) => expect(music[String(cue)], `${index}.yaml music ${cue}`).toBeTruthy());
      collectKey(chapter, 'sticker').forEach((sticker) =>
        expect(backgrounds[String(asRecord(sticker).image)], `${index}.yaml sticker`).toBeTruthy());
      const speakers = [
        ...collectKey(chapter, 'say').map((say) => asRecord(say).char),
        ...collectKey(chapter, 'say').flatMap((say) => (asRecord(say).with as unknown[] | undefined) ?? []),
        ...collectKey(chapter, 'choice').map((choice) => asRecord(choice).char),
      ].filter(Boolean).map(String);
      speakers.forEach((reference) => {
        const [id, emotion] = reference.split('.');
        expect(characters[id], `${index}.yaml character ${reference}`).toBeTruthy();
        if (emotion) expect(asRecord(asRecord(characters[id]).emotions)[emotion], reference).toBeTruthy();
      });
    });
  });

  it('declares every state variable the story reads or writes', () => {
    const declared = new Set(Object.keys(asRecord(baseYaml.state)));
    chapters.forEach((chapter, index) => {
      const written = collectKey(chapter, 'set').flatMap((entry) => Object.keys(asRecord(entry)));
      const read = collectKey(chapter, 'var').map(String);
      [...written, ...read].forEach((name) => expect(declared.has(name), `${index}.yaml ${name}`).toBe(true));
    });
  });

  it('sends every goto to a scene or chapter that exists', () => {
    chapters.forEach((chapter, index) => {
      const scenes = asRecord(chapter.scenes);
      collectKey(chapter, 'goto').map(String).forEach((target) => {
        if (target.startsWith('/')) {
          expect(existsSync(`${gameRoot}${target.slice(1)}`), `${index}.yaml ${target}`).toBe(true);
          return;
        }
        expect(scenes[target], `${index}.yaml goto ${target}`).toBeTruthy();
      });
    });
  });

  it('reaches all four endings, and lets a life stop in every dark', () => {
    const declared = Object.keys(asRecord(readYaml('config.yaml').endings));
    expect(declared.sort()).toEqual(['circle', 'onward', 'returner', 'still']);
    const used = new Set(chapters.flatMap((chapter) => collectKey(chapter, 'ending')).map(String));
    declared.forEach((ending) => expect(used.has(ending), ending).toBe(true));
    [0, 1, 2, 4].forEach((index) =>
      expect(collectKey(chapters[index], 'ending').map(String), `${index}.yaml`).toContain('still'));
  });

  it('shuts exactly one door in every life, whichever thing was taken last', () => {
    const refusedOptions = (chapter: number, choice: string, taken: string): number[] => {
      const scenes = asRecord(chapters[chapter].scenes);
      const found = collectKey(chapters[chapter], 'choice').map(asRecord).find((entry) => entry.key === choice);
      expect(found, choice).toBeTruthy();
      const options = (found!.options as unknown[]).map(asRecord);
      expect(options.length, choice).toBe(2);
      return options.flatMap((option, index) => {
        const actions = (asRecord(scenes[String(option.goto)]).actions as unknown[] | undefined) ?? [];
        const cases = collectKey(actions, 'cases').flat().map(asRecord);
        const shut = cases.some((entry) => {
          const when = asRecord(entry.when);
          return when.var === 'last_taken' && when.value === taken && String(entry.goto).includes('cannot');
        });
        return shut ? [index] : [];
      });
    };
    lifeGates.forEach(({ chapter, choice, shut, open }) => {
      shut.forEach((taken) =>
        expect(refusedOptions(chapter, choice, taken), `${choice} after ${taken}`).toHaveLength(1));
      open.forEach((taken) =>
        expect(refusedOptions(chapter, choice, taken), `${choice} after ${taken}`).toHaveLength(0));
    });
  });

  it('keeps lines short enough for the dialogue box', () => {
    const lines = chapters.flatMap((chapter) => collectKey(chapter, 'say')).map((say) => String(asRecord(say).text));
    expect(lines.length).toBeGreaterThan(250);
    lines.forEach((line) => expect(line.length, line).toBeLessThanOrEqual(84));
    const prompts = chapters.flatMap((chapter) => collectKey(chapter, 'choice')).map((choice) => String(asRecord(choice).prompt));
    prompts.forEach((prompt) => expect(prompt.length, prompt).toBeLessThanOrEqual(48));
  });

  it('never tells the player they are about to be born again', () => {
    const text = chapterPaths.map(readSource).join('\n');
    ['환생', '다시 태어', '전생의 나', '우주'].forEach((word) => expect(text, word).not.toContain(word));
  });
});
