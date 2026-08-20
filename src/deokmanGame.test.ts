import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/deokman/', import.meta.url));
const gameListRoot = fileURLToPath(new URL('../public/game-list/', import.meta.url));
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const biblePath = fileURLToPath(new URL('../docs/DEOKMAN_GAME_BIBLE.ko.md', import.meta.url));
const chapterPaths = Array.from({ length: 12 }, (_, index) => `${index}.yaml`);

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

const collectStrings = (value: unknown, result: string[] = []): string[] => {
  if (typeof value === 'string') {
    result.push(value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, result));
    return result;
  }
  Object.values(asRecord(value)).forEach((entry) => collectStrings(entry, result));
  return result;
};

const readPngCanvas = (path: string): { width: number; height: number; hasAlpha: boolean } => {
  const source = readFileSync(path);
  expect(source.subarray(0, 8), path).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(source.toString('ascii', 12, 16), path).toBe('IHDR');
  return {
    width: source.readUInt32BE(16),
    height: source.readUInt32BE(20),
    hasAlpha: source[25] === 4 || source[25] === 6,
  };
};

describe('complete Deokman visual novel', () => {
  it('resolves all twelve chapters through the production YAVN schema', () => {
    const config = parseConfigYaml(readSource('config.yaml'), 'deokman/config.yaml');
    const base = parseBaseYaml(readSource('base.yaml'), 'deokman/base.yaml');

    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    const parsedConfig = config.data;
    const parsedBase = base.data;
    expect(parsedConfig).toBeDefined();
    expect(parsedBase).toBeDefined();
    if (!parsedConfig || !parsedBase) return;

    chapterPaths.forEach((path) => {
      const chapter = parseChapterYaml(readSource(path), `deokman/${path}`);
      expect(chapter.error, path).toBeUndefined();
      expect(chapter.data, path).toBeDefined();
      if (!chapter.data) return;
      expect(resolveChapterGame({ config: parsedConfig, bases: [parsedBase], chapter: chapter.data }).error, path)
        .toBeUndefined();
    });
  });

  it('uses the canonical package identity instead of a preview package', () => {
    const config = parseConfigYaml(readSource('config.yaml'), 'deokman/config.yaml');
    const launcher = readYaml('launcher.yaml');

    expect(config.data?.data.title).toBe('선덕여왕: 죽은 공주의 왕관');
    expect(config.data?.data.version).toBe('9.6.0');
    expect(config.data?.data.startScreen?.image).toBe(
      'root:/game-list/deokman/assets/bg/title-deokman-v8-fire-v1.webp',
    );
    expect(config.data?.data.startScreen?.imagePosition).toBe('50% 50%');
    expect(config.data?.data.startScreen?.mobileImagePosition).toBe('72% 50%');
    expect(config.data?.data.endingScreen?.image).toBe(
      'root:/game-list/deokman/assets/bg/title-palace-silla-v3.webp',
    );
    expect(String(launcher.thumbnail)).toBe('assets/bg/title-deokman-v8-fire-v1.webp');
    expect(String(asRecord(launcher.showcase).label)).toBe('COMPLETE · 12 CHAPTERS');
    expect(readdirSync(gameListRoot).filter((name) => name.startsWith('deokman'))).toEqual(['deokman']);
  });

  it('connects chapters in order and ends only in the final chapter', () => {
    const documents = chapterPaths.map(readYaml);

    documents.slice(0, -1).forEach((document, index) => {
      const gotos = collectKey(document, 'goto').map(String);
      expect(gotos, `${index}.yaml`).toContain(`/${index + 1}.yaml`);
      expect(collectKey(document, 'ending'), `${index}.yaml`).toHaveLength(0);
    });

    expect(collectKey(documents.at(-1), 'goto').map(String).some((goto) => goto.startsWith('/'))).toBe(false);
    expect(new Set(collectKey(documents.at(-1), 'ending').map(String))).toEqual(new Set([
      'hidden_constellation',
      'stars_belong_to_people',
      'merciful_queen',
      'iron_queen',
      'borrowed_crown',
      'empty_observatory',
      'bidams_regent',
      'sisters_shadow',
      'recordless_peace',
      'fallen_star',
      'nameless_queen',
    ]));
  });

  it('carries one causal evidence chain across all twelve chapters', () => {
    const continuityAnchors = [
      ['0.yaml', '붉은 인장의 행로'],
      ['1.yaml', '붉은 인장을 사망 기록 옆에'],
      ['2.yaml', '암살자의 밀랍을 국경의 곡식길과 연결'],
      ['3.yaml', '당의 낙인이 드러났습니다'],
      ['4.yaml', '다음 일식의 관측표'],
      ['5.yaml', '계산표의 옥새'],
      ['6.yaml', '잃어버린 옥새 인주'],
      ['7.yaml', '쓰러지기 전부터 말라 있던 먹'],
      ['8.yaml', '다음 어둠은 누구나 미리 보게 하라'],
      ['9.yaml', '전령 매듭과 기름 먹인 대나무'],
      ['10.yaml', '사실보다 먼저 결론을 퍼뜨린 같은 방식'],
      ['11.yaml', '열두 해의 종이를 바닥에 길게'],
    ] as const;

    continuityAnchors.forEach(([path, anchor]) => expect(readSource(path), path).toContain(anchor));
  });

  it('ships a drama-sized choice and consequence graph without duplicate save keys', () => {
    const documents = chapterPaths.map(readYaml);
    const choices = documents.flatMap((document) => collectKey(document, 'choice').map(asRecord));
    const choiceKeys = choices.map((choice) => String(choice.key));
    const gameOvers = documents.flatMap((document) => collectKey(document, 'gameOver').map(asRecord));

    expect(choices).toHaveLength(36);
    expect(new Set(choiceKeys).size).toBe(choiceKeys.length);
    expect(choiceKeys[0]).toBe('c1_peony_observation');
    expect(choiceKeys.at(-1)).toBe('c12_final_decree');
    expect(gameOvers).toHaveLength(13);
    expect(choices.flatMap((choice) => Array.isArray(choice.options) ? choice.options.map(asRecord) : [])
      .some((option) => Object.keys(asRecord(option.gameOver)).length > 0)).toBe(false);

    documents.forEach((document, chapterIndex) => {
      const scenes = asRecord(document.scenes);
      Object.entries(scenes).forEach(([sceneId, sceneValue]) => {
        const rawActions = asRecord(sceneValue).actions;
        const actions = Array.isArray(rawActions) ? rawActions.map(asRecord) : [];
        const gameOverIndex = actions.findIndex((action) => Object.keys(asRecord(action.gameOver)).length > 0);
        if (gameOverIndex < 0) return;
        const leadIn = actions.slice(0, gameOverIndex);
        expect(gameOverIndex, `${chapterIndex}.yaml:${sceneId}`).toBe(actions.length - 1);
        expect(collectKey(leadIn, 'say').length, `${chapterIndex}.yaml:${sceneId}`).toBeGreaterThanOrEqual(4);
        expect(leadIn.some((action) => typeof action.bg === 'string'), `${chapterIndex}.yaml:${sceneId}`).toBe(true);
      });
    });
  });

  it('gives every crisis at least two viable strategies and keeps one dramatized failure', () => {
    const crisisChoiceKeys = [
      'c1_fire_escape',
      'c2_checkpoint',
      'c3_ambush',
      'c4_convoy',
      'c5_protocol',
      'c6_eclipse_riot',
      'c7_regency',
      'c8_first_response',
      'c9_coup_response',
      'c10_sabotage',
      'c11_rebellion_response',
    ];
    const fatalOptionPositions = new Set<'first' | 'middle' | 'last'>();

    chapterPaths.slice(0, -1).forEach((path, chapterIndex) => {
      const document = readYaml(path);
      const scenes = asRecord(document.scenes);
      const fatalSceneIds = new Set(Object.entries(scenes)
        .filter(([, scene]) => collectKey(scene, 'gameOver').length > 0)
        .map(([sceneId]) => sceneId));
      const resolveFatalScenes = (sceneId: string, visited = new Set<string>()): Set<string> => {
        if (!sceneId || sceneId.startsWith('/') || visited.has(sceneId)) return new Set();
        const scene = asRecord(scenes[sceneId]);
        if (fatalSceneIds.has(sceneId)) return new Set([sceneId]);
        const actions = Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
        const nextVisited = new Set(visited).add(sceneId);
        const outcomes = new Set<string>();

        actions.forEach((action) => {
          const nextChoice = asRecord(action.choice);
          if (Array.isArray(nextChoice.options) && nextChoice.options.length > 0) return;
          const targets = [
            typeof action.goto === 'string' ? action.goto : undefined,
            ...collectKey(action.branch, 'goto').map(String),
          ].filter((target): target is string => Boolean(target));
          targets.forEach((target) => {
            resolveFatalScenes(target, nextVisited).forEach((fatalScene) => outcomes.add(fatalScene));
          });
        });
        return outcomes;
      };
      const crisisChoice = collectKey(document, 'choice')
        .map(asRecord)
        .find((choice) => choice.key === crisisChoiceKeys[chapterIndex]);
      const options = Array.isArray(crisisChoice?.options) ? crisisChoice.options.map(asRecord) : [];
      const fatalOutcomes = options.map((option) => resolveFatalScenes(String(option.goto)));
      const fatalOptions = fatalOutcomes.filter((outcomes) => outcomes.size > 0);
      const convergedFatalScenes = new Set(fatalOutcomes.flatMap((outcomes) => [...outcomes]));
      fatalOutcomes.forEach((outcomes, optionIndex) => {
        if (outcomes.size === 0) return;
        fatalOptionPositions.add(optionIndex === 0
          ? 'first'
          : optionIndex === options.length - 1 ? 'last' : 'middle');
      });

      expect(options.length, path).toBeGreaterThanOrEqual(3);
      expect(fatalOptions.length, path).toBeGreaterThanOrEqual(1);
      expect(fatalOptions.length, path).toBeLessThanOrEqual(Math.floor(options.length / 2));
      expect(options.length - fatalOptions.length, path).toBeGreaterThanOrEqual(2);
      expect(convergedFatalScenes.size, path).toBe(1);
    });

    expect(fatalOptionPositions).toEqual(new Set(['first', 'middle', 'last']));
    expect(readSource('1.yaml')).toContain('recoverToChoice: c2_checkpoint');

    const fatalScenes = chapterPaths.flatMap((path) => {
      const scenes = asRecord(readYaml(path).scenes);
      return Object.values(scenes).filter((scene) => collectKey(scene, 'gameOver').length > 0);
    });
    fatalScenes.forEach((scene) => {
      expect(collectStrings(scene).join('\n')).toMatch(/죽|사망|처형|전사|피살|참수/);
    });
  });

  it('keeps ordinary political choices viable and rewards previously earned knowledge', () => {
    const ordinaryChoiceKeys = new Set([
      'c2_identity',
      'c2_witness',
      'c4_investigation',
      'c5_first_reply',
      'c6_find_time',
      'c7_confession',
      'c10_observatory_priority',
      'c11_falling_star',
    ]);
    const clueOrEndingChoiceKeys = new Set([
      'c1_peony_observation',
      'c1_answer_king',
      'c3_proof',
      'c3_sisters_strategy',
      'c4_grain_policy',
      'c5_diplomacy',
      'c6_eclipse_policy',
      'c7_first_power',
      'c8_public_story',
      'c8_cheonmyeong_fate',
      'c9_vote_strategy',
      'c9_crown_terms',
      'c10_knowledge_policy',
      'c11_bidam_answer',
      'c12_bidam_sentence',
      'c12_record_policy',
      'c12_final_decree',
    ]);

    const documents = chapterPaths.map(readYaml);
    const choices = documents.flatMap((document) => collectKey(document, 'choice').map(asRecord));
    const unsafeConditionalOptions: string[] = [];
    documents.forEach((document) => {
      const scenes = asRecord(document.scenes);
      const fatalSceneIds = new Set(Object.entries(scenes)
        .filter(([, scene]) => collectKey(scene, 'gameOver').length > 0)
        .map(([sceneId]) => sceneId));
      const reachesGameOver = (sceneId: string, visited = new Set<string>()): boolean => {
        if (!sceneId || sceneId.startsWith('/') || visited.has(sceneId)) return false;
        if (fatalSceneIds.has(sceneId)) return true;
        const actions = Array.isArray(asRecord(scenes[sceneId]).actions)
          ? (asRecord(scenes[sceneId]).actions as unknown[]).map(asRecord)
          : [];
        const nextVisited = new Set(visited).add(sceneId);
        return actions.some((action) => {
          const nextChoice = asRecord(action.choice);
          if (Array.isArray(nextChoice.options) && nextChoice.options.length > 0) return false;
          const targets = [
            typeof action.goto === 'string' ? action.goto : undefined,
            ...collectKey(action.branch, 'goto').map(String),
          ].filter((target): target is string => Boolean(target));
          return targets.some((target) => reachesGameOver(target, nextVisited));
        });
      };

      collectKey(document, 'choice').map(asRecord).forEach((choice) => {
        const key = String(choice.key);
        const options = Array.isArray(choice.options) ? choice.options.map(asRecord) : [];
        options.forEach((option) => {
          if (Object.keys(asRecord(option.when)).length > 0 && reachesGameOver(String(option.goto ?? ''))) {
            unsafeConditionalOptions.push(`${key}: ${String(option.text)}`);
          }
        });
        if (!ordinaryChoiceKeys.has(key)) return;
        const surviving = options.filter((option) =>
          Object.keys(asRecord(option.gameOver)).length === 0 && !reachesGameOver(String(option.goto ?? '')),
        );
        expect(surviving.length, key).toBeGreaterThanOrEqual(2);
      });
    });
    expect(unsafeConditionalOptions).toEqual([]);

    const fireEscape = choices.find((choice) => choice.key === 'c1_fire_escape');
    const fireOptions = Array.isArray(fireEscape?.options) ? fireEscape.options.map(asRecord) : [];
    expect(fireOptions.find((option) => option.text === '소화의 손을 잡고 배수로로 뛴다')?.when)
      .toEqual({ var: 'observed_left_waterway', op: 'eq', value: true });
    expect(String(fireOptions.find((option) => option.text === '기록을 품고 불길 너머 왕에게 간다')?.goto))
      .toBe('escape_with_record');

    const checkpoint = choices.find((choice) => choice.key === 'c2_checkpoint');
    const checkpointOptions = Array.isArray(checkpoint?.options) ? checkpoint.options.map(asRecord) : [];
    expect(String(checkpointOptions.find((option) =>
      option.text === '모란패로 문을 열고 붉은 인장으로 추격대를 고발한다')?.goto))
      .toBe('turn_checkpoint');

    const fallingStar = choices.find((choice) => choice.key === 'c11_falling_star');
    const fallingStarOptions = Array.isArray(fallingStar?.options) ? fallingStar.options.map(asRecord) : [];
    expect(String(fallingStarOptions.find((option) => option.text === '관측관들을 장터로 보내 진짜 별을 가리킨다')?.goto))
      .toBe('explain_sky');

    const conditionalLines = documents.flatMap((document) => collectKey(document, 'say').map(asRecord))
      .filter((say) => Object.keys(asRecord(say.when)).length > 0);
    expect(conditionalLines.length).toBeGreaterThanOrEqual(8);
    const readStateVariables = new Set(conditionalLines.flatMap((say) =>
      collectKey(say.when, 'var').map(String),
    ));
    const delayedPayoffVariables = [
      'diplomacy_policy',
      'observatory_priority',
      'used_false_omen',
      'king_trust',
      'yushin_trust',
      'chunchu_trust',
    ];
    expect(delayedPayoffVariables.filter((variable) => !readStateVariables.has(variable))).toEqual([]);

    const crisisKeys = new Set([
      'c1_fire_escape', 'c2_checkpoint', 'c3_ambush', 'c4_convoy', 'c5_protocol',
      'c6_eclipse_riot', 'c7_regency', 'c8_first_response', 'c9_coup_response',
      'c10_sabotage', 'c11_rebellion_response',
    ]);
    expect(new Set(choices.map((choice) => String(choice.key)))).toEqual(
      new Set([...ordinaryChoiceKeys, ...clueOrEndingChoiceKeys, ...crisisKeys]),
    );
  });

  it('keeps all player-facing prose inside dialogue, narration, and record channels', () => {
    const documents = chapterPaths.map(readYaml);
    const says = documents.flatMap((document) => collectKey(document, 'say').map(asRecord));
    const channels = new Set(says.map((say) => say.channel ?? (say.char ? 'dialogue' : 'narration')));
    const effects = new Set(documents.flatMap((document) => collectKey(document, 'effect').map((effect) =>
      typeof effect === 'string' ? effect : String(asRecord(effect).name),
    )));

    expect(channels).toEqual(new Set(['dialogue', 'narration', 'record']));
    expect(says.some((say) => say.channel === 'system')).toBe(false);
    expect(effects).toEqual(new Set(['embers', 'darken', 'eclipse', 'starfall', 'inkstamp']));
    expect(collectStrings(documents).join('\n')).toContain('별은 왕을 고르지 않는다');
  });

  it('keeps every local jump and recovery target valid', () => {
    const documents = chapterPaths.map(readYaml);
    const choiceKeys = new Set(documents.flatMap((document) =>
      collectKey(document, 'choice').map((choice) => String(asRecord(choice).key)),
    ));

    documents.forEach((document, chapterIndex) => {
      const scenes = asRecord(document.scenes);
      const assertSceneTarget = (target: string, source: string) => {
        if (target.startsWith('/')) {
          expect(target, source).toMatch(/^\/\d+\.yaml$/);
          expect(existsSync(`${gameRoot}${target.slice(1)}`), source).toBe(true);
          return;
        }
        expect(Object.prototype.hasOwnProperty.call(scenes, target), source).toBe(true);
      };

      collectKey(document, 'goto').map(String).forEach((target) =>
        assertSceneTarget(target, `${chapterIndex}.yaml goto ${target}`));
      collectKey(document, 'branch').map(asRecord).forEach((branch) => {
        if (typeof branch.default === 'string') {
          assertSceneTarget(branch.default, `${chapterIndex}.yaml branch default ${branch.default}`);
        }
      });
      collectKey(document, 'recoverToChoice').map(String).forEach((choiceKey) => {
        expect(choiceKeys.has(choiceKey), `${chapterIndex}.yaml recoverToChoice ${choiceKey}`).toBe(true);
      });
    });
  });

  it('stages every named speaker on every reachable local scene route', () => {
    chapterPaths.forEach((path) => {
      const document = readYaml(path);
      const scenes = asRecord(document.scenes);
      const script = Array.isArray(document.script) ? document.script.map(asRecord) : [];
      const openingScene = String(script[0]?.scene ?? '');
      const visited = new Set<string>();
      const failures: string[] = [];

      const visit = (sceneId: string, initialSlots: Record<string, string>) => {
        const signature = `${sceneId}|${JSON.stringify(Object.entries(initialSlots).sort())}`;
        if (!sceneId || visited.has(signature)) return;
        visited.add(signature);

        const rawActions = asRecord(scenes[sceneId]).actions;
        const actions = Array.isArray(rawActions) ? rawActions.map(asRecord) : [];
        const slots = { ...initialSlots };

        for (const [actionIndex, action] of actions.entries()) {
          const placement = asRecord(action.char);
          if (typeof placement.id === 'string' && typeof placement.position === 'string') {
            Object.entries(slots).forEach(([position, id]) => {
              if (id === placement.id) delete slots[position];
            });
            slots[placement.position] = placement.id;
          }

          const stageIds = Object.values(slots);
          const camera = action.camera;
          if (camera === 'close') failures.push(`${sceneId}[${actionIndex}] targetless close`);
          const cameraRecord = asRecord(camera);
          if (cameraRecord.shot === 'close' && typeof cameraRecord.target !== 'string') {
            failures.push(`${sceneId}[${actionIndex}] targetless close`);
          }
          if (typeof cameraRecord.target === 'string') {
            const target = cameraRecord.target.split('.')[0];
            if (!stageIds.includes(target)) failures.push(`${sceneId}[${actionIndex}] camera ${target}`);
          }

          for (const source of [asRecord(action.say), asRecord(action.choice)]) {
            if (source.camera === 'close' && typeof source.char !== 'string') {
              failures.push(`${sceneId}[${actionIndex}] speakerless close`);
            }
            const refs = [source.char, ...(Array.isArray(source.with) ? source.with : [])]
              .filter((ref): ref is string => typeof ref === 'string')
              .map((ref) => ref.split('.')[0]);
            refs.forEach((ref) => {
              if (!Object.values(slots).includes(ref)) failures.push(`${sceneId}[${actionIndex}] ${ref}`);
            });
          }

          const choice = asRecord(action.choice);
          const options = Array.isArray(choice.options) ? choice.options.map(asRecord) : [];
          if (options.length > 0) {
            options.forEach((option) => {
              if (typeof option.goto === 'string' && !option.goto.startsWith('/')) visit(option.goto, { ...slots });
            });
            return;
          }

          const branch = asRecord(action.branch);
          const cases = Array.isArray(branch.cases) ? branch.cases.map(asRecord) : [];
          if (cases.length > 0) {
            cases.forEach((entry) => {
              if (typeof entry.goto === 'string') visit(entry.goto, { ...slots });
            });
            if (typeof branch.default === 'string') visit(branch.default, { ...slots });
            return;
          }

          if (typeof action.goto === 'string' && !action.goto.startsWith('/')) {
            visit(action.goto, { ...slots });
            return;
          }
        }
      };

      visit(openingScene, {});
      expect(failures, path).toEqual([]);
      const reachableSceneIds = new Set([...visited].map((signature) => signature.split('|')[0]));
      expect(Object.keys(scenes).filter((sceneId) => !reachableSceneIds.has(sceneId)), `${path} unreachable scenes`)
        .toEqual([]);
    });
  });

  it('ships every referenced root asset and aligned transparent character sprites', () => {
    const base = readYaml('base.yaml');
    const config = readYaml('config.yaml');
    const launcher = readYaml('launcher.yaml');
    const assetPaths = collectStrings([base, config, launcher]).filter((path) => path.startsWith('root:/'));

    assetPaths.forEach((path) => {
      expect(existsSync(`${publicRoot}${path.slice('root:/'.length)}`), path).toBe(true);
    });

    const childSprites = [
      'deokman-child-silla-v8.png',
      'deokman-child-scared-silla-v8.png',
      'deokman-child-resolve-silla-v8.png',
    ].map((filename) => readPngCanvas(`${gameRoot}assets/char/${filename}`));

    expect(new Set(childSprites.map(({ width, height }) => `${width}x${height}`))).toEqual(new Set(['886x1775']));
    childSprites.forEach(({ hasAlpha }) => expect(hasAlpha).toBe(true));

    const adultStageFiles = [
      'deokman-wanderer-silla-v9.png',
      'deokman-wanderer-sad-silla-v9.png',
      'deokman-wanderer-angry-silla-v9.png',
      'deokman-princess-silla-v9.png',
      'deokman-princess-sad-silla-v9.png',
      'deokman-princess-angry-silla-v9.png',
      'deokman-attendant-silla-v9.png',
      'deokman-queen-silla-v9.png',
      'deokman-queen-sad-silla-v9.png',
      'deokman-queen-angry-silla-v9.png',
    ];
    const adultStageSprites = adultStageFiles.map((filename) => ({
      filename,
      ...readPngCanvas(`${gameRoot}assets/char/${filename}`),
    }));
    adultStageSprites.forEach(({ filename, width, height, hasAlpha }) => {
      expect(width, filename).toBeGreaterThanOrEqual(880);
      expect(width, filename).toBeLessThanOrEqual(890);
      expect(height, filename).toBeGreaterThanOrEqual(1770);
      expect(height, filename).toBeLessThanOrEqual(1790);
      expect(hasAlpha, filename).toBe(true);
    });

    expect(readSource('1.yaml')).toContain('emotion: wanderer');
    expect(readSource('2.yaml')).toContain('emotion: attendant');
    expect(readSource('2.yaml')).toContain('emotion: princess');
    expect(readSource('8.yaml')).toContain('emotion: queen');
    ['9.yaml', '10.yaml', '11.yaml'].forEach((path) => {
      expect(readSource(path), path).toContain('emotion: queen');
    });

    const itemFiles = [
      'peony-painting.svg',
      'death-register.svg',
      'peony-token.svg',
      'market-seal.svg',
      'grain-ledger.svg',
      'eclipse-table.svg',
      'empty-seal-box.svg',
      'star-chart.svg',
      'burnt-kite.svg',
      'bidam-letter.svg',
    ];
    itemFiles.forEach((filename) => {
      const source = readFileSync(`${gameRoot}assets/items/${filename}`, 'utf8');
      expect(source, filename).not.toMatch(/<text\b/);
      expect(source, filename).not.toMatch(/<rect[^>]+width=["']640["'][^>]+height=["']400["']/);
    });
  });

  it('documents the completed production package and twelve-chapter contract', () => {
    const bible = readFileSync(biblePath, 'utf8');
    expect(bible).toContain('## 12챕터 드라마 지도');
    expect(bible).toContain('| 12 | 마지막 기록 |');
    expect(bible).toContain('## 핵심 인물과 연기 방향');
    expect(bible).toContain('## 대사·내레이션·기록 채널');
    expect(bible).toContain('## 선택과 엔딩 설계 규칙');
    expect(bible).toContain('## V9.6 공정한 선택과 지연 회수');
    expect(bible).toContain('## 완결판 구현 현황');
    expect(bible).toContain('- 버전: `9.6.0`');
    expect(bible).toContain('총 13개의 장면형 실패');
    expect(bible).not.toContain('총 28개');
    expect(bible).toContain('/game-list/deokman/');
  });
});
