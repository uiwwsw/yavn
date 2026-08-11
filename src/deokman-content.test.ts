import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/deokman/', import.meta.url));
const chapters = ['0.yaml', '1.yaml', '2.yaml', '3.yaml', '4.yaml', '5.yaml', '6.yaml', '7.yaml'] as const;
const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const readYaml = (path: string): UnknownRecord => load(readFileSync(`${gameRoot}${path}`, 'utf8')) as UnknownRecord;

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

describe('Deokman complete-game content', () => {
  it('resolves every chapter through the full YAVN schema', () => {
    const config = parseConfigYaml(readFileSync(`${gameRoot}config.yaml`, 'utf8'), 'deokman/config.yaml');
    const base = parseBaseYaml(readFileSync(`${gameRoot}base.yaml`, 'utf8'), 'deokman/base.yaml');
    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    expect(config.data).toBeDefined();
    expect(base.data).toBeDefined();

    chapters.forEach((path) => {
      const chapter = parseChapterYaml(readFileSync(`${gameRoot}${path}`, 'utf8'), `deokman/${path}`);
      expect(chapter.error, path).toBeUndefined();
      expect(chapter.data).toBeDefined();
      if (!config.data || !base.data || !chapter.data) return;
      expect(resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data }).error, path)
        .toBeUndefined();
    });
  });

  it('locks the promised 24 four-option choices and 35 unique failure fates', () => {
    const documents = chapters.map(readYaml);
    const choices = documents.flatMap((document) => collectKey(document, 'choice')).map(asRecord);
    const gameOvers = documents.flatMap((document) => collectKey(document, 'gameOver')).map(asRecord);
    expect(choices).toHaveLength(24);
    choices.forEach((choice) => expect(choice.options).toHaveLength(4));
    expect(gameOvers).toHaveLength(35);
    const titles = gameOvers.map((entry) => String(entry.title));
    expect(new Set(titles).size).toBe(35);
    expect(titles[0]).toContain('운명 01');
    expect(titles.at(-1)).toContain('운명 35');
  });

  it('defines ten collectible endings including the locked true ending line', () => {
    const config = readYaml('config.yaml');
    expect(Object.keys(asRecord(config.endings))).toHaveLength(10);
    const finalChapter = readFileSync(`${gameRoot}7.yaml`, 'utf8');
    expect(finalChapter).toContain(
      '<speed=18>여왕이 아니다.</speed> <speed=42>신라의 왕이다.</speed>',
    );
    expect(collectKey(readYaml('7.yaml'), 'ending')).toHaveLength(10);
  });

  it('locks the authored character voices and dramatic reading rhythm', () => {
    const config = readYaml('config.yaml');
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const documents = chapters.map(readYaml);
    const waits = documents.flatMap((document) => collectKey(document, 'wait'));

    expect(config.version).toBe('2.4.0');
    expect(config.textSpeed).toBe(27);
    expect(waits.length).toBeGreaterThanOrEqual(10);
    expect(allContent).toContain('아버지 상여부터 보내 주세요. 즉위식은 그 뒤에 하겠습니다');
    expect(allContent).toContain('내 딸은 왕이 될 수 있다. 그리고 왕이 되지 않아도 내 딸이다');
    expect(allContent).toContain('이번에는 같이 들어가고 같이 나오는 거야');
    expect(allContent).toContain('우리 전사자는 여든하나입니다');
    expect(allContent).toContain('미안하다는 말보다 먼저 저를 숨겨 주세요');
    expect(allContent).toContain('그렇게 말하면 더 가고 싶어지는 성격이라서요');
    expect(allContent).toContain('나라의 법을 오늘 하루의 위기 때문에 바꿀 수는 없습니다');
    expect(allContent).toContain('공주를 믿는 게 아니라, 다른 길이 없어서 갑니다');
    expect(allContent).toContain('오늘은 제 말이 바뀌어도 제 입으로 바꾸겠습니다');
    expect(allContent).toContain('마음이 아니라 계획을 묻는 겁니다');
    expect(allContent).toContain('덕만은 가장 굵은 기둥 뒤로 몸을 붙였습니다');
    expect(allContent).not.toContain('참으로 고결하십니다');
    expect(allContent).not.toContain('대체 무엇을 왕관이라 부르십니까');
  });

  it('uses the historically attested Chilsuk instead of a fictional chief noble', () => {
    const base = readYaml('base.yaml');
    const characters = asRecord(asRecord(base.assets).characters);
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');

    expect(characters.칠숙).toBeDefined();
    expect(characters.국산).toBeUndefined();
    expect(asRecord(characters.칠숙).base).toBe('assets/char/chilsuk-silla-v4.webp');
    expect(allContent).toContain('칠숙');
    expect(allContent).not.toContain('국산');
    expect(allContent).toContain('이찬 칠숙');
  });

  it('directs every character beat with reusable full, bust, and close-up framings', () => {
    const base = readYaml('base.yaml');
    const characters = Object.values(asRecord(asRecord(base.assets).characters)).map(asRecord);
    const documents = chapters.map(readYaml);
    const characterPlacements = documents
      .flatMap((document) => collectKey(document, 'char'))
      .map(asRecord)
      .filter((placement) => typeof placement.id === 'string' && typeof placement.position === 'string');
    const speakerLines = documents
      .flatMap((document) => collectKey(document, 'say'))
      .map(asRecord)
      .filter((say) => typeof say.char === 'string');
    const choices = documents.flatMap((document) => collectKey(document, 'choice')).map(asRecord);

    characters.forEach((character) => {
      const framings = asRecord(character.framings);
      expect(character.defaultFraming).toBe('full');
      expect(Object.keys(framings)).toEqual(expect.arrayContaining(['full', 'bust', 'closeup']));
      expect(asRecord(framings.full).scale).toBe(1);
      expect(Number(asRecord(framings.bust).scale)).toBeGreaterThan(1);
      expect(Number(asRecord(framings.closeup).scale)).toBeGreaterThan(Number(asRecord(framings.bust).scale));
    });

    expect(characterPlacements).toHaveLength(173);
    characterPlacements.forEach((placement) => expect(placement.framing).toBe('full'));
    expect(speakerLines).toHaveLength(565);
    speakerLines.forEach((say) => expect(['full', 'bust', 'closeup']).toContain(say.framing));
    expect(new Set(speakerLines.map((say) => say.framing))).toEqual(new Set(['full', 'bust', 'closeup']));
    choices.forEach((choice) => expect(choice.framing).toBe('closeup'));

    documents.forEach((document) => {
      const placedIds = new Set(
        collectKey(document, 'char')
          .map(asRecord)
          .map((placement) => placement.id)
          .filter((id): id is string => typeof id === 'string'),
      );
      const speakerIds = collectKey(document, 'say')
        .map(asRecord)
        .map((say) => say.char)
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.split('.')[0]);
      expect(speakerIds.every((id) => placedIds.has(id))).toBe(true);
    });
  });

  it('dramatizes every failed choice before showing its game-over result', () => {
    const failureScenes = chapters.flatMap((path) => {
      const scenes = asRecord(readYaml(path).scenes);
      return Object.entries(scenes)
        .map(([sceneId, value]) => ({ path, sceneId, scene: asRecord(value) }))
        .filter(({ scene }) => {
          const actions = Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
          return actions.some((action) => Object.keys(asRecord(action.gameOver)).length > 0);
        });
    });

    expect(failureScenes).toHaveLength(35);
    failureScenes.forEach(({ path, sceneId, scene }) => {
      const actions = Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
      const gameOverIndex = actions.findIndex(
        (action) => Object.keys(asRecord(action.gameOver)).length > 0,
      );
      const leadIn = actions.slice(0, gameOverIndex);
      const says = leadIn.map((action) => asRecord(action.say)).filter((say) => Object.keys(say).length > 0);
      const firstSayIndex = leadIn.findIndex((action) => Object.keys(asRecord(action.say)).length > 0);
      const characterPlacements = leadIn
        .map((action) => asRecord(action.char))
        .filter((placement) => typeof placement.id === 'string');
      const decisiveCloseups = says.filter(
        (say) => say.framing === 'closeup' && Array.isArray(say.with),
      );

      expect(gameOverIndex, `${path}:${sceneId}`).toBe(actions.length - 1);
      expect(says.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(5);
      expect(
        says.filter((say) => typeof say.char === 'string').length,
        `${path}:${sceneId}`,
      ).toBeGreaterThanOrEqual(3);
      expect(asRecord(leadIn[firstSayIndex]?.say).char, `${path}:${sceneId}`).toBeUndefined();
      expect(characterPlacements.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(2);
      characterPlacements.forEach((placement) => expect(placement.framing).toBe('full'));
      expect(leadIn.some((action) => typeof action.effect === 'string'), `${path}:${sceneId}`).toBe(true);
      expect(
        says.some((say) => typeof say.wait === 'number'),
        `${path}:${sceneId}`,
      ).toBe(true);
      expect(decisiveCloseups.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(1);
    });
  });

  it('separates hidden, offscreen, distant, and confronted characters into intentional shots', () => {
    const sceneActions = (path: typeof chapters[number], sceneId: string) => {
      const scenes = asRecord(readYaml(path).scenes);
      const scene = asRecord(scenes[sceneId]);
      return Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
    };
    const say = (actions: UnknownRecord[], text: string) => {
      const action = actions.find((candidate) => String(asRecord(candidate.say).text).includes(text));
      return asRecord(action?.say);
    };

    const prologue = sceneActions('0.yaml', 'prologue_open');
    expect(say(prologue, '내일 진시').with).toEqual(['아진']);
    expect(say(prologue, '왕이 쓰러지면').with).toEqual(['칠숙']);
    expect(say(prologue, '마른 대나무').with).toEqual(['덕만']);
    expect(asRecord(sceneActions('0.yaml', 'caught_choice')[0].choice).with).toEqual([]);

    const lockedRoom = sceneActions('2.yaml', 'chapter2_end');
    expect(say(lockedRoom, '들어오지 마세요').with).toEqual([]);
    expect(say(lockedRoom, '살아 있어?').with).toEqual([]);
    expect(say(lockedRoom, '문턱을 넘지 않은 채').with).toEqual(['덕만']);

    const borrowedCorpse = sceneActions('3.yaml', 'go_18_borrowed_corpse');
    const chilsukRevealIndex = borrowedCorpse.findIndex(
      (action) => asRecord(action.char).id === '칠숙',
    );
    const warningIndex = borrowedCorpse.findIndex(
      (action) => String(asRecord(action.say).text).includes('멀리서 야간 교대 종'),
    );
    expect(chilsukRevealIndex).toBeGreaterThan(warningIndex);

    const distantAmbush = sceneActions('5.yaml', 'go_30_martyr_prince');
    expect(say(distantAmbush, '행렬은 비탈 위에').with).toEqual(['덕만']);
    expect(say(distantAmbush, '숲에 사람이 있습니다').with).toEqual([]);
    expect(say(distantAmbush, '그대 호위가 처리할 일').with).toEqual([]);
    expect(say(distantAmbush, '덕만…… 공주').with).toEqual(['덕만']);

    const hiddenCarriage = sceneActions('6.yaml', 'entry_procession');
    const hiddenDialogue = hiddenCarriage
      .map((action) => asRecord(action.say))
      .filter((line) => typeof line.char === 'string');
    hiddenDialogue.forEach((line) => expect(line.with).toEqual([]));
    expect(say(hiddenCarriage, '서로의 얼굴을 보았습니다').with).toEqual(['덕만', '천명']);

    const gateConfrontation = sceneActions('6.yaml', 'go_31_gate_breaker');
    expect(say(gateConfrontation, '곡소리가 시작되고').with).toEqual(['덕만']);
    expect(say(gateConfrontation, '역적이라 부릅니다').with).toEqual(['덕만']);

    const warehouseDistance = sceneActions('6.yaml', 'go_32_name_in_dark');
    expect(say(warehouseDistance, '세 걸음을 사이에').with).toEqual(['덕만', '아진']);
    expect(say(warehouseDistance, '칼 한 자루보다 짧았습니다').with).toEqual(['덕만', '아진']);
  });

  it('builds each chapter from reciprocal conversations instead of isolated monologues', () => {
    chapters.forEach((path) => {
      const scenes = Object.values(asRecord(readYaml(path).scenes)).map(asRecord);
      const reciprocalScenes = scenes.filter((scene) => {
        const actions = Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
        const speakers = actions
          .map((action) => asRecord(action.say).char)
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.split('.')[0]);
        return speakers.length >= 3 && new Set(speakers).size >= 2;
      });

      expect(reciprocalScenes.length, path).toBeGreaterThanOrEqual(8);
    });
  });

  it('introduces relationships, motives, and costs before all 24 choices', () => {
    const contexts = [
      ['0.yaml', 'prologue_open', 'p_caught', '뜻을 가진 딸이 칼을 가진 아들보다 위험할 때가 있습니다'],
      ['0.yaml', 'warn_choice', 'p_warn', '언니 천명은 내 말을 의심하지 않겠지만 칼이 없어'],
      ['0.yaml', 'banquet_choice', 'p_cup', '연회 반대편에는 왕의 잔을 준비한 대신들을 대표해 칠숙이'],
      ['1.yaml', 'chapter1_open', 'c1_investigate', '덕만에게 남은 사람은 많지 않았습니다'],
      ['1.yaml', 'rumor_choice', 'c1_rumor', '그는 덕만의 신하도, 칠숙의 사람도 아니었습니다'],
      ['1.yaml', 'evidence_choice', 'c1_evidence', '아버지께만 보이면 내 누명은 벗지만 배후는 숨을 거야'],
      ['2.yaml', 'chapter2_open', 'c2_suitor', '왕실 방계의 진운공은 혼인의 당사자이고'],
      ['2.yaml', 'reputation_choice', 'c2_reputation', '별을 핑계로 대면 월명이 거짓말쟁이가 되고'],
      ['2.yaml', 'throne_choice', 'c2_throne', '한 집만 택하면 나머지 두 집이 계승동맹으로 뭉치고'],
      ['3.yaml', 'chapter3_open', 'c3_body', '죽은 사람은 혼인 합의서를 덕만에게 넘긴 귀족이었습니다'],
      ['3.yaml', 'testimony_choice', 'c3_testimony', '높은 분도 낮은 사람도 먼지한테는 거짓말을 시킬 수 없으니까요'],
      ['3.yaml', 'culprit_choice', 'c3_culprit', '아버지 잔에도, 내 방의 시체에도 네 붉은 매듭이 남았어'],
      ['4.yaml', 'chapter4_open', 'c4_grain', '저는 이곳에서 약을 짓는 월명입니다'],
      ['4.yaml', 'defense_choice', 'c4_defense', '마을에는 오늘 곡식을 나눠 준 가족들이 있고'],
      ['4.yaml', 'enemy_choice', 'c4_enemy', '이번에는 적군의 통행패를 목에 걸고 있었습니다'],
      ['5.yaml', 'chapter5_open', 'c5_contest', '진평왕과 먼 친족인 왕실 남자였고'],
      ['5.yaml', 'leverage_choice', 'c5_leverage', '그대는 내 신하가 아니라서 곁에 둔 사람이야'],
      ['5.yaml', 'rescue_choice', 'c5_rescue', '저를 살려도 왕위는 양보하지 않습니다'],
      ['6.yaml', 'chapter6_open', 'c6_entry', '월명 선생은 약재 수로에서 기다리고'],
      ['6.yaml', 'rescue_choice', 'c6_rescue', '아진이 빈 약함을 들고 달아났다는 보고가 있습니다'],
      ['6.yaml', 'seal_found', 'c6_seal', '나라의 도장이기 전에 아버지가 평생 쥐고 있던 물건이야'],
      ['7.yaml', 'final_open', 'final_opening', '진운공과 함께 들어가면 그의 가문을 갈라놓을 수 있습니다'],
      ['7.yaml', 'proof_choice', 'final_proof', '공주와 가까운 나인, 목숨을 빚진 살인자'],
      ['7.yaml', 'crown_choice', 'final_crown', '화백의 표를 택하면 귀족들이 붙인 조건을 받아들여야 했고'],
    ] as const;

    expect(contexts).toHaveLength(24);
    expect(new Set(contexts.map(([, , key]) => key)).size).toBe(24);
    contexts.forEach(([path, sceneId, choiceKey, anchor]) => {
      const scenes = asRecord(readYaml(path).scenes);
      const scene = asRecord(scenes[sceneId]);
      const actions = Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
      const anchorIndex = actions.findIndex((action) => String(asRecord(action.say).text).includes(anchor));
      const choiceIndex = actions.findIndex((action) => asRecord(action.choice).key === choiceKey);
      const choiceSceneId = Object.entries(scenes).find(([, value]) => {
        const candidateActions = asRecord(value).actions;
        return Array.isArray(candidateActions) && candidateActions.some(
          (action) => asRecord(asRecord(action).choice).key === choiceKey,
        );
      })?.[0];

      expect(anchorIndex, `${path}:${sceneId} relationship context`).toBeGreaterThanOrEqual(0);
      expect(choiceSceneId, `${path}:${choiceKey}`).toBeDefined();
      if (choiceIndex >= 0) {
        expect(choiceIndex, `${path}:${sceneId} ${choiceKey}`).toBeGreaterThan(anchorIndex);
      } else {
        const gotoIndex = actions.findIndex((action) => action.goto === choiceSceneId);
        expect(gotoIndex, `${path}:${sceneId} -> ${choiceSceneId}`).toBeGreaterThan(anchorIndex);
      }
    });
  });

  it('keeps every speaking character visibly staged on every reachable branch', () => {
    chapters.forEach((path) => {
      const document = readYaml(path);
      const scenes = asRecord(document.scenes);
      const script = Array.isArray(document.script) ? document.script.map(asRecord) : [];
      const openingScene = String(script[0]?.scene ?? '');
      const visited = new Set<string>();
      const failures: string[] = [];

      const visit = (sceneId: string, initialSlots: Record<string, string>, trail: string[]) => {
        const signature = `${sceneId}|${JSON.stringify(Object.entries(initialSlots).sort())}`;
        if (!sceneId || visited.has(signature)) return;
        visited.add(signature);

        const scene = asRecord(scenes[sceneId]);
        const actions = Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
        const slots = { ...initialSlots };
        const verifyVisible = (source: UnknownRecord, actionIndex: number) => {
          const ids = [source.char, ...(Array.isArray(source.with) ? source.with : [])]
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.split('.')[0]);
          ids.forEach((id) => {
            if (!Object.values(slots).includes(id)) {
              failures.push(`${sceneId}[${actionIndex}] ${id} is absent after ${trail.join(' > ')}`);
            }
          });
        };

        for (const [actionIndex, action] of actions.entries()) {
          const placement = asRecord(action.char);
          if (typeof placement.id === 'string' && typeof placement.position === 'string') {
            Object.entries(slots).forEach(([position, id]) => {
              if (id === placement.id) delete slots[position];
            });
            slots[placement.position] = placement.id;
          }

          const say = asRecord(action.say);
          if (Object.keys(say).length > 0) verifyVisible(say, actionIndex);
          const choice = asRecord(action.choice);
          if (Object.keys(choice).length > 0) verifyVisible(choice, actionIndex);

          const nextTrail = [...trail, sceneId];
          const options = Array.isArray(choice.options) ? choice.options.map(asRecord) : [];
          if (options.length > 0) {
            options.forEach((option) => {
              if (typeof option.goto === 'string' && !option.goto.startsWith('/')) {
                visit(option.goto, { ...slots }, nextTrail);
              }
            });
            return;
          }

          const branch = asRecord(action.branch);
          const cases = Array.isArray(branch.cases) ? branch.cases.map(asRecord) : [];
          if (cases.length > 0) {
            cases.forEach((branchCase) => {
              if (typeof branchCase.goto === 'string' && !branchCase.goto.startsWith('/')) {
                visit(branchCase.goto, { ...slots }, nextTrail);
              }
            });
            if (typeof branch.default === 'string' && !branch.default.startsWith('/')) {
              visit(branch.default, { ...slots }, nextTrail);
            }
            return;
          }

          if (typeof action.goto === 'string' && !action.goto.startsWith('/')) {
            visit(action.goto, { ...slots }, nextTrail);
            return;
          }
          if (Object.keys(asRecord(action.gameOver)).length > 0 || typeof action.ending === 'string') return;
        }
      };

      visit(openingScene, {}, []);
      expect(failures, path).toEqual([]);
    });
  });

  it('gives all ten characters a base portrait plus two authored expression performances', () => {
    const base = readYaml('base.yaml');
    const characters = asRecord(asRecord(base.assets).characters);
    const documents = chapters.map(readYaml);
    const spokenCharacters = new Set(
      documents
        .flatMap((document) => collectKey(document, 'say'))
        .map(asRecord)
        .filter((say) => typeof say.char === 'string')
        .map((say) => String(say.char)),
    );

    expect(Object.keys(characters)).toHaveLength(10);
    Object.entries(characters).forEach(([name, value]) => {
      const character = asRecord(value);
      const emotions = asRecord(character.emotions);
      expect(String(character.base), name).toMatch(/-silla-v4\.webp$/);
      expect(Object.keys(emotions), name).toHaveLength(2);
      Object.keys(emotions).forEach((emotion) => {
        expect(spokenCharacters.has(`${name}.${emotion}`), `${name}.${emotion}`).toBe(true);
      });
    });
  });

  it('keeps every crisis choice compact enough to scan without breaking the drama', () => {
    const choices = chapters.flatMap((path) => collectKey(readYaml(path), 'choice')).map(asRecord);

    choices.forEach((choice) => {
      expect(Array.from(String(choice.prompt)).length).toBeLessThanOrEqual(30);
      const options = Array.isArray(choice.options) ? choice.options.map(asRecord) : [];
      options.forEach((option) => expect(Array.from(String(option.text)).length).toBeLessThanOrEqual(16));
    });
  });

  it('keeps the numbered chapters in one automatic 1/8 to 8/8 sequence', () => {
    chapters.slice(0, -1).forEach((path) => {
      const document = readYaml(path);
      expect(document.script, path).toHaveLength(2);
      expect(readFileSync(`${gameRoot}${path}`, 'utf8'), path).not.toMatch(/goto:\s*\/\d+\.ya?ml/);
    });
  });

  it('ships every declared visual asset inside the game directory', () => {
    const base = readYaml('base.yaml');
    const assets = asRecord(base.assets);
    const paths = [
      ...Object.values(asRecord(assets.backgrounds)),
      ...Object.values(asRecord(assets.characters)).flatMap((entry) => {
        const character = asRecord(entry);
        return [character.base, ...Object.values(asRecord(character.emotions))];
      }),
      ...Object.values(asRecord(base.inventory)).map((entry) => asRecord(entry).image),
    ];
    paths.forEach((path) => {
      expect(typeof path).toBe('string');
      expect(existsSync(`${gameRoot}${String(path)}`), String(path)).toBe(true);
    });
  });

  it('uses broadly compatible WebP for every rendered background and title image', () => {
    const base = readYaml('base.yaml');
    const config = readYaml('config.yaml');
    const launcher = readYaml('launcher.yaml');
    const backgrounds = Object.values(asRecord(asRecord(base.assets).backgrounds));
    const titleImages = [
      asRecord(config.startScreen).image,
      asRecord(config.endingScreen).image,
      launcher.thumbnail,
    ];

    [...backgrounds, ...titleImages].forEach((path) => {
      expect(String(path)).toMatch(/\.webp$/);
      expect(existsSync(`${gameRoot}${String(path)}`), String(path)).toBe(true);
    });
  });

  it('keeps every authored scene reachable from its chapter opening', () => {
    chapters.forEach((path) => {
      const document = readYaml(path);
      const scenes = asRecord(document.scenes);
      const script = Array.isArray(document.script) ? document.script.map(asRecord) : [];
      const scriptIds = script.map((entry) => String(entry.scene));
      const reached = new Set<string>();
      const pending = [scriptIds[0]];

      while (pending.length > 0) {
        const sceneId = pending.pop();
        if (!sceneId || reached.has(sceneId) || !scenes[sceneId]) continue;
        reached.add(sceneId);
        const actions = asRecord(scenes[sceneId]).actions;
        collectKey(actions, 'goto')
          .filter((target): target is string => typeof target === 'string' && !target.startsWith('/'))
          .forEach((target) => pending.push(target));
        collectKey(actions, 'default')
          .filter((target): target is string => typeof target === 'string' && !target.startsWith('/'))
          .forEach((target) => pending.push(target));
        const scriptIndex = scriptIds.indexOf(sceneId);
        if (scriptIndex >= 0 && scriptIds[scriptIndex + 1]) pending.push(scriptIds[scriptIndex + 1]);
      }

      expect([...Object.keys(scenes).filter((sceneId) => !reached.has(sceneId))], path).toEqual([]);
    });
  });

  it('labels the rival as fictional and updates the intended relationship state', () => {
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const base = readFileSync(`${gameRoot}base.yaml`, 'utf8');
    expect(allContent).not.toContain('사륜');
    expect(allContent).toContain('진운');
    expect(base).toContain('cheonmyeong_trust: 0');
    const prologue = readYaml('0.yaml');
    const choices = collectKey(prologue, 'choice').map(asRecord);
    const warningChoice = choices.find((choice) => choice.key === 'p_warn');
    const options = Array.isArray(warningChoice?.options) ? warningChoice.options.map(asRecord) : [];
    const sisterOption = options.find((option) => String(option.text).includes('천명'));
    expect(asRecord(sisterOption?.add)).toEqual({ cheonmyeong_trust: 1 });
  });

  it('keeps the expanded Silla art set distinctive, typed, and below six megabytes', () => {
    const base = readYaml('base.yaml');
    const config = readYaml('config.yaml');
    const assets = asRecord(base.assets);
    const backgrounds = Object.values(asRecord(assets.backgrounds)).map(String);
    const characters = Object.values(asRecord(assets.characters)).map(asRecord);
    const activeImages = new Set([
      ...backgrounds,
      ...characters.flatMap((character) => [
        String(character.base),
        ...Object.values(asRecord(character.emotions)).map(String),
      ]),
      String(asRecord(config.seo).image),
    ]);
    const totalBytes = [...activeImages].reduce(
      (total, path) => total + statSync(`${gameRoot}${path}`).size,
      0,
    );

    expect(new Set(backgrounds).size).toBeGreaterThanOrEqual(10);
    expect(characters).toHaveLength(10);
    characters.forEach((character) => {
      expect(String(character.base)).toMatch(/-silla-v4\.webp$/);
      expect(String(character.defaultDelivery)).toMatch(
        /^(neutral|calm|nervous|angry|whisper|shout|sad|deduction)$/,
      );
    });
    expect(asRecord(characters.find((character) => String(character.base).includes('deokman'))?.emotions))
      .toEqual({
        sad: 'assets/char/deokman-sad-silla-v4.webp',
        angry: 'assets/char/deokman-angry-silla-v4.webp',
      });
    expect(asRecord(characters.find((character) => String(character.base).includes('cheonmyeong'))?.emotions))
      .toEqual({
        nervous: 'assets/char/cheonmyeong-nervous-silla-v4.webp',
        sad: 'assets/char/cheonmyeong-sad-silla-v4.webp',
      });
    expect(new Set(characters.flatMap((character) => [character.base, ...Object.values(asRecord(character.emotions))])).size)
      .toBe(30);
    expect(backgrounds.every((path) => path.includes('-silla-v3.webp'))).toBe(true);
    expect(totalBytes).toBeLessThan(6_000_000);
    expect(existsSync(`${gameRoot}assets/bg/title-palace.png`)).toBe(false);
    expect(existsSync(`${gameRoot}assets/bg/council-hall.png`)).toBe(false);
    expect(existsSync(`${gameRoot}assets/bg/frontier.png`)).toBe(false);
  });
});
