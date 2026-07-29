import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml } from './parser';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/conan/', import.meta.url));
const chapterFiles = [
  '0.yaml',
  '1.yaml',
  '2.yaml',
  'conclusion/1.yaml',
  'routes/haruo/1.yaml',
  'routes/hub/1.yaml',
  'routes/kenji/1.yaml',
  'routes/reiko/1.yaml',
  'routes/seiji/1.yaml',
] as const;

const readYaml = (path: string): UnknownRecord =>
  load(readFileSync(`${gameRoot}${path}`, 'utf8')) as UnknownRecord;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const collectBackgroundKeys = (value: unknown, keys = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectBackgroundKeys(item, keys));
    return keys;
  }

  const record = asRecord(value);
  if (typeof record.bg === 'string') keys.add(record.bg);
  Object.values(record).forEach((item) => collectBackgroundKeys(item, keys));
  return keys;
};

const sceneActions = (document: UnknownRecord, scene: string): UnknownRecord[] => {
  const scenes = asRecord(document.scenes);
  const actions = asRecord(scenes[scene]).actions;
  return Array.isArray(actions) ? actions.map(asRecord) : [];
};

const setValues = (actions: UnknownRecord[]): UnknownRecord =>
  actions.reduce<UnknownRecord>(
    (values, action) => ({ ...values, ...asRecord(action.set) }),
    {},
  );

const resolveGameAsset = (assetPath: string): string =>
  `${gameRoot}${assetPath.replace(/^\//, '')}`;

describe('Conan content regression', () => {
  it('parses the config, bases, and every chapter with the engine schema', () => {
    const config = parseConfigYaml(
      readFileSync(`${gameRoot}config.yaml`, 'utf8'),
      'conan/config.yaml',
    );
    const base = parseBaseYaml(readFileSync(`${gameRoot}base.yaml`, 'utf8'), 'conan/base.yaml');
    const routesBase = parseBaseYaml(
      readFileSync(`${gameRoot}routes/base.yaml`, 'utf8'),
      'conan/routes/base.yaml',
    );

    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    expect(routesBase.error).toBeUndefined();

    chapterFiles.forEach((path) => {
      const parsed = parseChapterYaml(readFileSync(`${gameRoot}${path}`, 'utf8'), `conan/${path}`);
      expect(parsed.error, path).toBeUndefined();
    });
  });

  it('keeps every scene background mapped to an existing asset', () => {
    const base = readYaml('base.yaml');
    const backgrounds = asRecord(asRecord(base.assets).backgrounds);
    const referencedKeys = new Set<string>();

    chapterFiles.forEach((path) => collectBackgroundKeys(readYaml(path), referencedKeys));

    expect([...referencedKeys].sort()).toEqual(
      expect.arrayContaining([
        'case_board',
        'manager_office',
        'mountain_rain',
        'rain_corridor',
        'records_lounge',
        'ryokan_hall',
        'tea_room',
      ]),
    );

    referencedKeys.forEach((key) => {
      expect(backgrounds, `Missing background key: ${key}`).toHaveProperty(key);
      const assetPath = backgrounds[key];
      expect(typeof assetPath).toBe('string');
      expect(existsSync(resolveGameAsset(String(assetPath))), String(assetPath)).toBe(true);
    });
  });

  it('uses unique v2 raster art and a readable text title screen', () => {
    const base = readYaml('base.yaml');
    const config = readYaml('config.yaml');
    const launcher = readYaml('launcher.yaml');
    const backgrounds = Object.values(asRecord(asRecord(base.assets).backgrounds));
    const startScreen = asRecord(config.startScreen);
    const endingScreen = asRecord(config.endingScreen);
    const rasterPaths = [
      ...backgrounds,
      startScreen.image,
      endingScreen.image,
      launcher.thumbnail,
    ].filter((value): value is string => typeof value === 'string' && value.endsWith('.avif'));
    const uniquePaths = [...new Set(rasterPaths.map((assetPath) => assetPath.replace(/^\//, '')))];

    expect(startScreen.showTitle).toBe(true);
    expect(startScreen.buttonPosition).toBe('bottom-center');
    uniquePaths.forEach((assetPath) => {
      expect(assetPath).toMatch(/-v2\.avif$/);
      expect(existsSync(resolveGameAsset(assetPath)), assetPath).toBe(true);
    });

    const hashes = uniquePaths.map((assetPath) =>
      createHash('sha256').update(readFileSync(resolveGameAsset(assetPath))).digest('hex'),
    );
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('allows missed core evidence to be recovered on a revisit', () => {
    const reiko = readYaml('routes/reiko/1.yaml');
    const haruo = readYaml('routes/haruo/1.yaml');
    const seiji = readYaml('routes/seiji/1.yaml');

    expect(setValues(sceneActions(reiko, 'evidence_followup'))).toMatchObject({
      recovered_reiko_motive: true,
    });
    expect(sceneActions(reiko, 'evidence_followup')).toContainEqual({
      goto: 'motive_open_line',
    });

    expect(setValues(sceneActions(haruo, 'evidence_followup'))).toMatchObject({
      clue_haruo_wipe: true,
      clue_rim_reagent: true,
      recovered_haruo_clue: true,
    });

    expect(setValues(sceneActions(seiji, 'evidence_followup'))).toMatchObject({
      clue_order_note: true,
      recovered_order_note: true,
    });
  });
});
