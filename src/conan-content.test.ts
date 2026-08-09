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

  it('ships the v10.6 episode identity and all seven music cues', () => {
    const config = readYaml('config.yaml');
    const base = readYaml('base.yaml');
    const music = asRecord(asRecord(base.assets).music);
    const referencedMusic = new Set<string>();

    chapterFiles.forEach((path) => collectStringValues(readYaml(path), 'music', referencedMusic));

    expect(config.title).toBe('명탐정 코난 외전: 폭우의 2번 찻잔');
    expect(config.version).toBe('10.6.0');
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

  it('maps the added emotional beats to existing transparent character assets', () => {
    const base = readYaml('base.yaml');
    const characters = asRecord(asRecord(base.assets).characters);
    const expectedEmotions = [
      ['코난', 'smile'],
      ['란', 'determined'],
      ['코고로', 'shocked'],
      ['켄지', 'smile'],
      ['세이지', 'amused'],
      ['레이코', 'smile'],
      ['하루오', 'smile'],
    ] as const;

    expectedEmotions.forEach(([characterId, emotion]) => {
      const assetPath = asRecord(asRecord(characters[characterId]).emotions)[emotion];
      expect(typeof assetPath, `${characterId}.${emotion}`).toBe('string');
      expect(existsSync(resolveGameAsset(String(assetPath))), String(assetPath)).toBe(true);
    });
  });

  it('never stacks the police tape, clue card, and character portrait together', () => {
    const actions = sceneActions(readYaml('2.yaml'), 'death_confirm');
    const stickerId = (action: UnknownRecord): unknown => asRecord(action.sticker).id;
    const clearedStickerId = (action: UnknownRecord): unknown =>
      asRecord(action.clearSticker).id;
    const tapeClearIndex = actions.findIndex(
      (action) => clearedStickerId(action) === 'tape_lock',
    );
    const clueShowIndex = actions.findIndex((action) => stickerId(action) === 'dying_hint');
    const clueClearIndex = actions.findIndex(
      (action) => clearedStickerId(action) === 'dying_hint',
    );
    const firstCharacterDialogueIndex = actions.findIndex(
      (action) => typeof asRecord(action.say).char === 'string',
    );
    const clueDialogue = asRecord(actions[clueShowIndex + 1]?.say);
    const conanReturnIndex = actions.findIndex(
      (action, index) =>
        index > clueClearIndex && asRecord(action.say).char === '코난.think',
    );

    expect(tapeClearIndex).toBeGreaterThan(-1);
    expect(tapeClearIndex).toBeLessThan(firstCharacterDialogueIndex);
    expect(tapeClearIndex).toBeLessThan(clueShowIndex);
    expect(actions[tapeClearIndex + 1]?.wait).toBeGreaterThanOrEqual(220);
    expect(clueDialogue.char).toBeUndefined();
    expect(clueClearIndex).toBeGreaterThan(clueShowIndex);
    expect(actions[clueClearIndex + 1]?.wait).toBeGreaterThanOrEqual(220);
    expect(conanReturnIndex).toBeGreaterThan(clueClearIndex);
  });

  it('ends the full reveal with confession and an in-character morning coda', () => {
    const conclusion = readYaml('conclusion/1.yaml');
    const revealActions = sceneActions(conclusion, 'true_epilogue');
    const codaActions = sceneActions(conclusion, 'true_coda');
    const codaFinishActions = sceneActions(conclusion, 'true_coda_finish');
    const revealText = [...collectStringValues(revealActions, 'text')].join(' ');
    const codaText = [...collectStringValues(codaActions, 'text')].join(' ');
    const codaFinishText = [...collectStringValues(codaFinishActions, 'text')].join(' ');

    expect(revealActions).toContainEqual({ music: 'confession' });
    expect(revealActions).toContainEqual({ goto: 'true_coda' });
    expect(revealText).toContain('이름 하나라도 빼면 거래는 없다');
    expect(codaActions).toContainEqual({ music: 'rain' });
    expect(codaFinishActions).toContainEqual({ ending: 'true_end' });
    expect(codaText).toContain('또 본인이 한 추리만 기억 안 나시죠');
    expect(codaFinishText).toContain('아무 일도 없으면 좋겠어요');
  });

  it('keeps system verdict language out of playable dialogue and choices', () => {
    const narrativeText = chapterFiles
      .flatMap((path) => [...collectStringValues(readYaml(path), 'text')])
      .join(' ');

    ['정답을 채택', '조사 라인', '보너스를 획득', '사건의 기준으로 삼을까'].forEach(
      (phrase) => expect(narrativeText).not.toContain(phrase),
    );
  });

  it('keeps the warm opening interactive and pays attention back during the incident', () => {
    const baseState = asRecord(readYaml('base.yaml').state);
    const chapter0 = readYaml('0.yaml');
    const chapter1 = readYaml('1.yaml');
    const chapter2 = readYaml('2.yaml');
    const conclusion = readYaml('conclusion/1.yaml');
    const souvenirOptions = choiceOptions(sceneActions(chapter0, 'souvenir_corner'));
    const holidayOptions = choiceOptions(sceneActions(chapter0, 'table_tennis'));
    const helperOptions = choiceOptions(sceneActions(chapter1, 'tea_helper_choice'));
    const namingOptions = choiceOptions(sceneActions(chapter1, 'tea_name_choice'));
    const rememberedOption = helperOptions.find(
      (option) => asRecord(option.set).remembered_tea_order === true,
    );
    const peopleOption = namingOptions.find(
      (option) => asRecord(option.set).tea_name_vote === 'people',
    );
    const serviceOrderBranch = sceneActions(chapter2, 'service_order').find((action) =>
      Object.prototype.hasOwnProperty.call(action, 'branch'),
    );
    const serviceOrderCases = asRecord(serviceOrderBranch?.branch).cases;

    expect(baseState.remembered_tea_order).toBe(false);
    expect(baseState.tea_name_vote).toBe('');
    expect(baseState.souvenir_choice).toBe('');
    expect(souvenirOptions).toHaveLength(3);
    expect(holidayOptions).toHaveLength(3);
    expect(helperOptions).toHaveLength(3);
    expect(namingOptions).toHaveLength(3);
    expect(asRecord(rememberedOption?.add).trust).toBe(1);
    expect(asRecord(peopleOption?.add).trust).toBe(1);
    expect(serviceOrderCases).toContainEqual({
      when: {
        var: 'remembered_tea_order',
        op: 'eq',
        value: true,
      },
      goto: 'service_order_memory',
    });
    expect(sceneActions(chapter2, 'service_order_memory')).toContainEqual({
      add: {
        deduction_score: 1,
      },
    });
    expect(sceneActions(conclusion, 'true_coda')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branch: expect.objectContaining({
            default: 'true_coda_postcard',
          }),
        }),
      ]),
    );
  });

  it('keeps canned AI-like phrasing out of playable dialogue and choices', () => {
    const playableText = chapterFiles
      .flatMap((path) => [...collectStringValues(readYaml(path), 'text')])
      .map(stripDialogueMarkup)
      .join(' ');

    expect(playableText).not.toMatch(/열대(?:일|야)(?:이)?네/);
    [
      '회복에 최적화된 위치',
      '이제 같은 장면 안에 들어왔어',
      '30초씩 다시',
      '네 사람의 30초',
      '빈 1분이 보인다',
      '잔과 시각으로 버틴다',
    ].forEach((phrase) => expect(playableText).not.toContain(phrase));
  });

  it('holds the incident until after an eight-minute interactive warm opening', () => {
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
    const commonPreIncidentActions = [
      ...orderedSceneActions(chapter0),
      ...orderedSceneActions(chapter1),
      ...preIncidentScenes,
    ];
    const tableTennisBranches = [
      'table_tennis_coach',
      'table_tennis_referee',
      'table_tennis_cheer',
    ];
    const souvenirBranches = [
      ['souvenir_paddle', 'quiet_night_paddle'],
      ['souvenir_tea', 'quiet_night_tea'],
      ['souvenir_postcard', 'quiet_night_postcard'],
    ];
    const teaHelperBranches = ['tea_helper_correct', 'tea_helper_lid', 'tea_helper_kogoro'];
    const teaNameBranches = ['tea_name_rain', 'tea_name_people', 'tea_name_detective'];
    const routeDurations = souvenirBranches.flatMap(
      ([souvenirScene, souvenirCallbackScene]) =>
        tableTennisBranches.flatMap((tableTennisScene) =>
          teaHelperBranches.flatMap((teaHelperScene) =>
            teaNameBranches.map((teaNameScene) =>
              estimateDialogueSeconds(
                [
                  ...commonPreIncidentActions,
                  ...sceneActions(chapter0, souvenirScene),
                  ...sceneActions(chapter0, souvenirCallbackScene),
                  ...sceneActions(chapter0, tableTennisScene),
                  ...sceneActions(chapter1, teaHelperScene),
                  ...sceneActions(chapter1, teaNameScene),
                ],
                Number(config.textSpeed),
              ),
            ),
          ),
        ),
    );

    expect(routeDurations).toHaveLength(81);
    expect(incidentIndex).toBeGreaterThan(0);
    expect(Math.min(...routeDurations)).toBeGreaterThan(480);
  });

  it('keeps the first chapter load scoped to the core trio', () => {
    const firstChapter = readYaml('0.yaml');
    const characterIds = collectStringValues(firstChapter, 'id');

    expect([...characterIds].sort()).toEqual(['란', '코고로', '코난']);
    expect(collectBackgroundKeys(firstChapter)).toEqual(
      new Set([
        'dining_room',
        'guest_room',
        'mountain_rain',
        'rain_corridor',
        'recreation_room',
        'souvenir_corner',
      ]),
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

  it('keeps relationship-specific speech levels for Conan, Ran, and Kogoro', () => {
    const spokenLines = chapterFiles.flatMap((path) =>
      orderedSceneActions(readYaml(path))
        .map((action) => asRecord(action.say))
        .filter(
          (say) =>
            typeof say.char === 'string' &&
            !stripDialogueMarkup(say.text).trim().startsWith('('),
        )
        .map((say) => ({
          char: String(say.char).split('.')[0],
          text: stripDialogueMarkup(say.text),
        })),
    );
    const conanText = spokenLines
      .filter((line) => line.char === '코난')
      .map((line) => line.text)
      .join(' ');
    const ranText = spokenLines
      .filter((line) => line.char === '란')
      .map((line) => line.text)
      .join(' ');

    expect(conanText).toContain('란 누나, 저기 봐.');
    expect(conanText).toContain('란 누나, 모두를 다실로 불러 줘.');
    expect(conanText).toContain('응. 셋이서.');
    expect(conanText).not.toContain('란 누나, 저기 봐요.');
    expect(conanText).toContain('아저씨 손에 벌써 두 개 있는데요?');
    expect(conanText).toContain('아저씨 고민은 저녁에 다시 커질 것 같아요.');
    expect(ranText).toContain('아빠, 우산 좀 안쪽으로 들어오세요.');
    expect(ranText).toContain('셋 다 의뢰비는 아빠가 내는 거 아시죠?');
    expect(ranText).toContain('아빠가 다 해결하셨잖아요.');
    expect(ranText).not.toContain('아빠, 우산 좀 안쪽으로 들어.');
  });

  it('uses game over only after the player confirms a wrong final accusation', () => {
    const conclusion = readYaml('conclusion/1.yaml');
    const initialAccusation = choiceOptions(sceneActions(conclusion, 'final_accuse_gate'));
    const wrongConfirmation = choiceOptions(sceneActions(conclusion, 'accuse_confirm_other'));
    const comeback = choiceOptions(sceneActions(conclusion, 'comeback_gate'));

    expect(initialAccusation.filter((option) => option.gameOver)).toHaveLength(0);
    expect(asRecord(wrongConfirmation[1].gameOver).title).toBe('추리 실패');
    expect(comeback.slice(1).every((option) => asRecord(option.gameOver).title === '추리 실패')).toBe(true);
    expect(asRecord(comeback[0].gameOver)).toEqual({});
  });
});
