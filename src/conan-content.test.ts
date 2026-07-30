import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml } from './parser';
import { buildTypingPlan, parseInlineSpeed, resolveDialogueDelivery } from './typing';
import type { DialogueDelivery } from './types';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/conan/', import.meta.url));
const chapterFiles = [
  '0.yaml',
  '1.yaml',
  '2.yaml',
  '3.yaml',
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

const collectStringValues = (
  value: unknown,
  property: string,
  values = new Set<string>(),
): Set<string> => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, property, values));
    return values;
  }

  const record = asRecord(value);
  if (typeof record[property] === 'string') values.add(String(record[property]));
  Object.values(record).forEach((item) => collectStringValues(item, property, values));
  return values;
};

const sceneActions = (document: UnknownRecord, scene: string): UnknownRecord[] => {
  const scenes = asRecord(document.scenes);
  const actions = asRecord(scenes[scene]).actions;
  return Array.isArray(actions) ? actions.map(asRecord) : [];
};

const orderedSceneActions = (document: UnknownRecord): UnknownRecord[] => {
  const script = document.script;
  if (!Array.isArray(script)) return [];

  return script.flatMap((entry) => {
    const scene = asRecord(entry).scene;
    return typeof scene === 'string' ? sceneActions(document, scene) : [];
  });
};

const stripDialogueMarkup = (text: unknown): string =>
  String(text ?? '').replace(/<[^>]+>/g, '');

const estimateDialogueSeconds = (actions: UnknownRecord[], defaultSpeed: number): number =>
  actions.reduce((seconds, action) => {
    const say = asRecord(action.say);
    if (typeof say.text !== 'string') return seconds;

    const parsed = parseInlineSpeed(say.text);
    const speakerEmotion =
      typeof say.char === 'string' ? say.char.split('.', 2)[1] : undefined;
    const delivery = resolveDialogueDelivery(
      typeof say.delivery === 'string' ? (say.delivery as DialogueDelivery) : undefined,
      speakerEmotion,
    );
    const typingSeconds =
      buildTypingPlan({
        text: parsed.text,
        baseSpeed: defaultSpeed,
        delivery,
        speedSegments: parsed.segments,
      }).reduce((duration, step) => duration + step.delayMs, 0) / 1000;

    return seconds + typingSeconds + 2.2;
  }, 0);

const setValues = (actions: UnknownRecord[]): UnknownRecord =>
  actions.reduce<UnknownRecord>(
    (values, action) => ({ ...values, ...asRecord(action.set) }),
    {},
  );

const choiceOptions = (actions: UnknownRecord[]): UnknownRecord[] => {
  const choiceAction = actions.find((action) =>
    Object.prototype.hasOwnProperty.call(action, 'choice'),
  );
  const options = asRecord(choiceAction?.choice).options;
  return Array.isArray(options) ? options.map(asRecord) : [];
};

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

  it('rewards character-specific interrogation approaches', () => {
    const baseState = asRecord(readYaml('base.yaml').state);
    const approaches = [
      ['routes/seiji/1.yaml', 'rapport_seiji'],
      ['routes/reiko/1.yaml', 'rapport_reiko'],
      ['routes/kenji/1.yaml', 'rapport_kenji'],
      ['routes/haruo/1.yaml', 'rapport_haruo'],
    ] as const;

    expect(baseState.rapport_score).toBe(0);

    approaches.forEach(([path, flag]) => {
      expect(baseState[flag], flag).toBe(false);
      const options = choiceOptions(sceneActions(readYaml(path), 'approach_probe'));
      const alignedOption = options.find((option) => asRecord(option.set)[flag] === true);

      expect(alignedOption, `${path}:${flag}`).toBeDefined();
      expect(asRecord(alignedOption?.add).rapport_score).toBe(1);
      expect(asRecord(alignedOption?.add).trust).toBe(1);
    });

    const hubBonus = sceneActions(readYaml('routes/hub/1.yaml'), 'rapport_bonus');
    expect(hubBonus).toContainEqual({
      add: {
        final_confidence: 1,
      },
    });
  });

  it('opens the episode with an explicit two-character exchange', () => {
    const introActions = sceneActions(readYaml('0.yaml'), 'holiday_arrival');
    const dialogue = introActions
      .map((action) => asRecord(action.say))
      .filter((say) => typeof say.char === 'string');
    const ranLine = dialogue.find((say) => say.char === '란');
    const kogoroLine = dialogue.find((say) => say.char === '코고로.proud');

    expect(ranLine?.with).toEqual(['코고로.proud']);
    expect(kogoroLine?.with).toEqual(['란']);
  });

  it('ships the v10.1.1 episode identity and all seven music cues', () => {
    const config = readYaml('config.yaml');
    const base = readYaml('base.yaml');
    const music = asRecord(asRecord(base.assets).music);
    const referencedMusic = new Set<string>();

    chapterFiles.forEach((path) => collectStringValues(readYaml(path), 'music', referencedMusic));

    expect(config.title).toBe('명탐정 코난 외전: 폭우의 2번 찻잔');
    expect(config.version).toBe('10.1.1');
    expect(Object.keys(music).sort()).toEqual([
      'confession',
      'intro',
      'mystery',
      'rain',
      'reasoning',
      'solvethecase',
      'tension',
    ]);
    expect([...referencedMusic].sort()).toEqual(
      expect.arrayContaining([
        'confession',
        'mystery',
        'rain',
        'reasoning',
        'solvethecase',
        'tension',
      ]),
    );

    Object.values(music).forEach((assetPath) => {
      expect(typeof assetPath).toBe('string');
      expect(existsSync(resolveGameAsset(String(assetPath))), String(assetPath)).toBe(true);
    });
  });

  it('ends the full reveal with confession and an in-character morning coda', () => {
    const conclusion = readYaml('conclusion/1.yaml');
    const revealActions = sceneActions(conclusion, 'true_epilogue');
    const codaActions = sceneActions(conclusion, 'true_coda');
    const revealText = [...collectStringValues(revealActions, 'text')].join(' ');
    const codaText = [...collectStringValues(codaActions, 'text')].join(' ');

    expect(revealActions).toContainEqual({ music: 'confession' });
    expect(revealActions).toContainEqual({ goto: 'true_coda' });
    expect(revealText).toContain('이름 하나라도 빼면 거래는 없다');
    expect(codaActions).toContainEqual({ music: 'rain' });
    expect(codaActions).toContainEqual({ ending: 'true_end' });
    expect(codaText).toContain('또 자기가 한 추리만 기억 안 나지');
    expect(codaText).toContain('함께 만든 사람들의 이름');
  });

  it('keeps system verdict language out of playable dialogue and choices', () => {
    const narrativeText = chapterFiles
      .flatMap((path) => [...collectStringValues(readYaml(path), 'text')])
      .join(' ');

    ['정답을 채택', '조사 라인', '보너스를 획득', '사건의 기준으로 삼을까'].forEach(
      (phrase) => expect(narrativeText).not.toContain(phrase),
    );
  });

  it('holds the incident until after a six-minute warm opening', () => {
    const config = readYaml('config.yaml');
    const chapter0 = readYaml('0.yaml');
    const chapter1 = readYaml('1.yaml');
    const chapter2 = readYaml('2.yaml');
    const chapter2Script = Array.isArray(chapter2.script) ? chapter2.script.map(asRecord) : [];
    const incidentIndex = chapter2Script.findIndex((entry) => entry.scene === 'incident_trigger');
    const preIncidentScenes = chapter2Script
      .slice(0, incidentIndex)
      .flatMap((entry) =>
        typeof entry.scene === 'string' ? sceneActions(chapter2, entry.scene) : [],
      );
    const preIncidentActions = [
      ...orderedSceneActions(chapter0),
      ...orderedSceneActions(chapter1),
      ...preIncidentScenes,
    ];

    expect(incidentIndex).toBeGreaterThan(0);
    expect(estimateDialogueSeconds(preIncidentActions, Number(config.textSpeed))).toBeGreaterThan(
      360,
    );
  });

  it('keeps the first chapter load scoped to the core trio', () => {
    const firstChapter = readYaml('0.yaml');
    const characterIds = collectStringValues(firstChapter, 'id');

    expect([...characterIds].sort()).toEqual(['란', '코고로', '코난']);
    expect(collectBackgroundKeys(firstChapter)).toEqual(
      new Set(['mountain_rain', 'rain_corridor', 'ryokan_hall']),
    );
  });

  it('keeps Conan inner thoughts brief and observation-led', () => {
    const monologues = chapterFiles.flatMap((path) =>
      orderedSceneActions(readYaml(path))
        .map((action) => asRecord(action.say))
        .filter(
          (say) =>
            typeof say.char === 'string' &&
            say.char.startsWith('코난') &&
            stripDialogueMarkup(say.text).trim().startsWith('('),
        )
        .map((say) => stripDialogueMarkup(say.text)),
    );

    expect(monologues.length).toBeGreaterThan(20);
    monologues.forEach((text) => {
      expect([...text].length, text).toBeLessThanOrEqual(48);
    });

    const combined = monologues.join(' ');
    ['사람마다', '결론은', '설명할 수 있어', '확인하면 돼'].forEach((phrase) =>
      expect(combined).not.toContain(phrase),
    );
  });
});
