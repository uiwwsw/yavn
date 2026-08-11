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
      '<speed=17>여왕이 아니다.</speed> <speed=18>신라의 왕이다.</speed>',
    );
    expect(collectKey(readYaml('7.yaml'), 'ending')).toHaveLength(10);
  });

  it('locks the authored character voices and dramatic reading rhythm', () => {
    const config = readYaml('config.yaml');
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const documents = chapters.map(readYaml);
    const waits = documents.flatMap((document) => collectKey(document, 'wait'));

    expect(config.version).toBe('3.2.0');
    expect(config.textSpeed).toBe(27);
    expect(waits.length).toBeGreaterThanOrEqual(10);
    expect(allContent).toContain('아버지 상여부터 보내 주세요. 제가 왕이 되는 의식은 그 뒤에 하겠습니다');
    expect(allContent).toContain('내 딸은 왕이 될 수 있다.</speed> <speed=18>그리고 왕이 되지 않아도 내 딸이다');
    expect(allContent).toContain('이번에는 같이 들어가고 같이 나오는 거야');
    expect(allContent).toContain('우리 전사자는 여든하나입니다');
    expect(allContent).toContain('미안하다는 말보다 먼저 저를 숨겨 주세요');
    expect(allContent).toContain('그렇게 말하면 더 가고 싶어지는 성격이라서요');
    expect(allContent).toContain('저는 여인이 왕좌에 앉는 모습을 보고 싶지 않습니다');
    expect(allContent).toContain('공주를 믿는 게 아니라, 다른 길이 없어서 갑니다');
    expect(allContent).toContain('오늘은 제 말이 바뀌어도 제 입으로 바꾸겠습니다');
    expect(allContent).toContain('마음이 아니라 계획을 묻는 겁니다');
    expect(allContent).toContain('덕만은 가장 굵은 기둥 뒤로 몸을 붙였습니다');
    expect(allContent).not.toContain('참으로 고결하십니다');
    expect(allContent).not.toContain('대체 무엇을 왕관이라 부르십니까');
  });

  it('keeps every inner life readable while balancing easy words, daily chatter, and weighted lines', () => {
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const hardPhrases = [
      '국경 위무의 전권',
      '정사 발언',
      '지아비',
      '왕경',
      '인영',
      '유폐',
      '추존',
      '계승권',
      '한 됫박',
      '한 시진',
      '반 시진',
      '한 식경',
      '초경',
      '이경',
      '삼경',
      '진시',
      '처소',
      '호위부를',
      '각개 격파',
      '폐위',
      '인주',
      '관식',
      '즉위',
      '서약',
      '배후',
    ];
    hardPhrases.forEach((phrase) => expect(allContent).not.toContain(phrase));
    expect(allContent).toContain('귀족 회의인 화백');

    const visibleEmotionAnchors = [
      '네가 태어난 날부터 내게는 네가 가장 귀했다',
      '나는 네 동생도 살리고, 너도 살리고 싶어',
      '이번에는 같이 들어가고 같이 나오는 거야',
      '어느 쪽도 버리고 싶지 않습니다',
      '‘원’ 자가 조금 뚱뚱합니다',
      '장부를 쥔 손에 힘이 풀렸습니다',
      '수도 출입패를 풀자 칠숙의 입꼬리가 먼저 올라갔습니다',
      '오른쪽 신발 끈이 풀렸습니다',
      '진운은 비녀를 쥔 손을 탁자 아래로 숨겼습니다',
      '저는 굶는 아이를 보고 그냥 돌아서는 법을 모릅니다',
    ];
    visibleEmotionAnchors.forEach((anchor) => expect(allContent).toContain(anchor));

    const dailyBreathers = [
      '꿀 많이 묻은 쪽은 제 거예요',
      '오른쪽 소매는 자꾸 길어',
      '‘말 안 듣는 장수’로 하죠',
      '코는 만지지 마세요',
      '먼지는 한 끼로 세지 않습니다',
      '넘어져 죽는 건 제 명령이 아닙니다',
      '저도 생강은 골라 냅니다',
      '내 이름도 옆에 똑같이 뚱뚱하게 써 줘',
    ];
    dailyBreathers.forEach((anchor) => {
      const line = allContent.split('\n').find((candidate) => candidate.includes(anchor));
      expect(line, anchor).toBeDefined();
      expect(line).not.toContain('<speed=');
    });

    const weightedSegments = allContent.match(/<speed=(?:1[7-9]|2[0-2])>/g) ?? [];
    expect(weightedSegments.length).toBeGreaterThanOrEqual(20);
  });

  it('uses the historically attested Chilsuk instead of a fictional chief noble', () => {
    const base = readYaml('base.yaml');
    const characters = asRecord(asRecord(base.assets).characters);
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');

    expect(characters.칠숙).toBeDefined();
    expect(characters.국산).toBeUndefined();
    expect(asRecord(characters.칠숙).base).toBe('assets/char/chilsuk-silla-v5.webp');
    expect(allContent).toContain('칠숙');
    expect(allContent).not.toContain('국산');
    expect(allContent).toContain('이찬 칠숙');
  });

  it('directs every character beat with shared camera shots instead of per-character zoom', () => {
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
    const sceneActionLists = documents.flatMap((document) =>
      Object.values(asRecord(document.scenes)).map((scene) => {
        const actions = asRecord(scene).actions;
        return Array.isArray(actions) ? actions.map(asRecord) : [];
      }),
    );

    characters.forEach((character) => {
      const calibration = asRecord(character.calibration);
      expect(Number(calibration.scale)).toBeGreaterThanOrEqual(0.5);
      expect(Number(calibration.scale)).toBeLessThanOrEqual(2);
      expect(character.defaultFraming).toBeUndefined();
      expect(character.framings).toBeUndefined();
    });

    expect(characterPlacements).toHaveLength(221);
    characterPlacements.forEach((placement) => expect(placement.framing).toBeUndefined());
    expect(speakerLines).toHaveLength(679);
    speakerLines.forEach((say) => expect(['wide', 'medium', 'close']).toContain(say.camera));
    expect(new Set(speakerLines.map((say) => say.camera))).toEqual(new Set(['wide', 'medium', 'close']));
    choices.forEach((choice) => {
      expect(choice.camera).toBe('close');
      expect(Array.isArray(choice.with)).toBe(true);
    });
    const backgroundCuts = sceneActionLists.flatMap((actions) =>
      actions.flatMap((action, index) => (typeof action.bg === 'string' ? [{ actions, index }] : [])),
    );
    expect(backgroundCuts).toHaveLength(66);
    backgroundCuts.forEach(({ actions, index }) => expect(actions[index + 1]?.camera).toBe('wide'));
    expect(chapters.every((path) => !readFileSync(`${gameRoot}${path}`, 'utf8').includes('framing:'))).toBe(true);

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
        (say) => say.camera === 'close' && Array.isArray(say.with),
      );

      expect(gameOverIndex, `${path}:${sceneId}`).toBe(actions.length - 1);
      expect(says.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(5);
      expect(
        says.filter((say) => typeof say.char === 'string').length,
        `${path}:${sceneId}`,
      ).toBeGreaterThanOrEqual(3);
      expect(asRecord(leadIn[firstSayIndex]?.say).char, `${path}:${sceneId}`).toBeUndefined();
      expect(characterPlacements.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(2);
      characterPlacements.forEach((placement) => expect(placement.framing).toBeUndefined());
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
    expect(say(prologue, '내일 해가 막 오른 아침').with).toEqual(['아진']);
    expect(say(prologue, '왕이 쓰러지면').with).toEqual(['칠숙']);
    expect(say(prologue, '마른 대나무').with).toEqual(['덕만']);
    expect(asRecord(sceneActions('0.yaml', 'caught_choice')[0].choice).with).toEqual([]);

    const lockedRoom = sceneActions('2.yaml', 'chapter2_end');
    expect(say(lockedRoom, '문 아래로 검붉은 피').with).toEqual(['덕만']);
    expect(say(lockedRoom, '제가 나올 때 직접 잠갔어요').with).toEqual(['덕만']);
    expect(say(lockedRoom, '대답 대신 문을 한 번').with).toEqual(['덕만', '소원']);

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
      ['0.yaml', 'prologue_open', 'p_caught', '저는 여자가 왕이 되는 꼴을 보고 싶지 않습니다'],
      ['0.yaml', 'warn_choice', 'p_warn', '탁자 위에 네 가지를 놓았습니다'],
      ['0.yaml', 'banquet_choice', 'p_cup', '전하의 두 번째 잔은 제가 올리겠습니다'],
      ['1.yaml', 'chapter1_open', 'c1_investigate', '부엌, 기록 창고, 호위 막사 가운데'],
      ['1.yaml', 'rumor_choice', 'c1_rumor', '아까 같은 거짓말을 두 나인에게'],
      ['1.yaml', 'evidence_choice', 'c1_evidence', '하인은 제가 지킬 수 있습니다'],
      ['2.yaml', 'chapter2_open', 'c2_suitor', '궁을 버리는 길에는 공주의 장수로'],
      ['2.yaml', 'reputation_choice', 'c2_reputation', '비녀 끝이 별을 읽은 표와 약봉지'],
      ['2.yaml', 'throne_choice', 'c2_throne', '세 가문의 도장을 왕좌 앞에'],
      ['3.yaml', 'chapter3_open', 'c3_body', '비담에게 합의서 원본을 넘긴 왕실 문서 담당자야'],
      ['3.yaml', 'testimony_choice', 'c3_testimony', '높은 분도 낮은 사람도 먼지한테는 거짓말을 시킬 수 없으니까요'],
      ['3.yaml', 'culprit_choice', 'c3_culprit', '아버지 잔에도, 내 방의 시체에도 네 붉은 매듭이 남았어'],
      ['4.yaml', 'chapter4_open', 'c4_grain', '수도에서 혼담의 별을 함께 보던 월명입니다'],
      ['4.yaml', 'defense_choice', 'c4_defense', '마을에는 오늘 제 손으로 곡식을 건넨 가족들이 있습니다'],
      ['4.yaml', 'enemy_choice', 'c4_enemy', '남은 한 짝입니다'],
      ['5.yaml', 'chapter5_open', 'c5_contest', '왕자가 아닙니다'],
      ['5.yaml', 'leverage_choice', 'c5_leverage', '그대는 내 신하가 아니라서 곁에 둔 사람이야'],
      ['5.yaml', 'rescue_choice', 'c5_rescue', '저를 살려도 왕위는 양보하지 않습니다'],
      ['6.yaml', 'chapter6_open', 'c6_entry', '약초 끈을 따라가면 월명이 수로에서'],
      ['6.yaml', 'rescue_choice', 'c6_rescue', '아진이 빈 약 상자를 들고 달아났다는 보고가 있습니다'],
      ['6.yaml', 'seal_found', 'c6_seal', '어릴 때 한 번 들어 보고 너무 무거워'],
      ['7.yaml', 'final_open', 'final_opening', '진운공과 함께 들어가면 그의 가문을 갈라놓을 수 있습니다'],
      ['7.yaml', 'proof_choice', 'final_proof', '공주와 가까운 나인, 목숨을 빚진 살인자'],
      ['7.yaml', 'crown_choice', 'final_crown', '귀족의 표를 받으시면 오늘 안에 왕이 될 수 있습니다'],
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

  it('shows each chapter premise through an enacted visual-novel episode instead of a setting summary', () => {
    const episodeAnchors = [
      ['0.yaml', 'prologue_open', '네가 좋아하니 남겨 둔 것이다'],
      ['1.yaml', 'chapter1_open', '덕만의 연꽃 노리개가 굴러 나와 왕좌 아래에서 멈췄습니다'],
      ['2.yaml', 'chapter2_open', '혼인하면 공주는 나라일에 입을 열 수 없고 남편이 대신 말한다'],
      ['3.yaml', 'chapter3_open', '두 번째 어깨로 밀자 안쪽 빗장이 부러졌고'],
      ['4.yaml', 'chapter4_open', '수도 출입패는 놓고 가시지요'],
      ['5.yaml', 'chapter5_open', '왕자가 아닙니다'],
      ['6.yaml', 'chapter6_open', '‘덕만을 잡으라’는 글을 뜯어 품에 감췄습니다'],
      ['7.yaml', 'final_open', '왕의 상여가 동문 아래에서 멈췄습니다'],
    ] as const;
    const forbiddenSummaries = [
      '진평왕에게는 아들이 없었습니다',
      '덕만에게 남은 사람은 많지 않았습니다',
      '덕만은 사흘 동안 세 혼담의 당사자들을 차례로 만났습니다',
      '죽은 사람은 혼인 합의서를 덕만에게 넘긴 귀족이었습니다',
      '살인 누명에서 벗어난 대가로 덕만은',
      '진운은 왕의 아들이 아니었습니다',
      '덕만과 진운이 함께 암살 조사를 요구한 바로 그날',
      '칠숙은 아들이 없는 왕의 뒤에는 남자가 와야 한다며',
    ];

    episodeAnchors.forEach(([path, sceneId, anchor]) => {
      const scene = asRecord(asRecord(readYaml(path).scenes)[sceneId]);
      const actions = Array.isArray(scene.actions) ? scene.actions.map(asRecord) : [];
      const lines = actions.map((action) => asRecord(action.say)).filter((say) => Object.keys(say).length > 0);
      const speakers = lines
        .map((say) => say.char)
        .filter((speaker): speaker is string => typeof speaker === 'string')
        .map((speaker) => speaker.split('.')[0]);

      expect(lines.some((say) => String(say.text).includes(anchor)), `${path}:${sceneId}`).toBe(true);
      expect(speakers.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(4);
      expect(new Set(speakers).size, `${path}:${sceneId}`).toBeGreaterThanOrEqual(2);
    });

    const fullText = chapters.map((path) => JSON.stringify(readYaml(path))).join('\n');
    forbiddenSummaries.forEach((summary) => expect(fullText).not.toContain(summary));
  });

  it('anchors elapsed time with restrained narrator bridges and no impossible deadlines', () => {
    const timelineAnchors = {
      '0.yaml': ['연회 전날 · 저녁 식사 뒤', '같은 밤 · 모두 잠든 한밤중', '연회 당일 · 해가 막 오른 아침'],
      '1.yaml': ['연회 다음 날 · 아침', '첫째 날 · 해 질 무렵', '사흘째 · 새벽', '사흘째 · 밤'],
      '2.yaml': ['누명을 벗은 다음 날 아침', '같은 날 · 정오', '같은 날 · 해 질 무렵', '혼인을 거부한 날 · 해가 진 뒤'],
      '3.yaml': ['같은 밤 · 해가 진 지 얼마 안 된 때', '같은 밤 · 새벽 직전', '동틀 무렵', '그날 아침 열린 귀족 회의'],
      '4.yaml': ['수도를 떠난 지 열이틀째 · 해 질 무렵', '도착 이튿날 · 해 질 무렵', '전투가 끝난 이튿날 · 낮', '며칠 뒤'],
      '5.yaml': ['수도로 돌아온 지 사흘째 · 귀족 회의 날', '회의가 두 시간쯤 멈춘 사이', '같은 날 · 해가 진 뒤', '같은 밤 · 해가 진 뒤 한참 지난 때'],
      '6.yaml': ['같은 밤 · 밤이 깊은 때', '깊은 밤이 끝나기 전', '밥 한 끼 먹을 시간도 지나지 않아', '새벽을 알리는 북이 울리기 직전', '동이 틀 무렵'],
      '7.yaml': ['진평왕이 숨을 거둔 이튿날 · 해 질 무렵', '해가 지고 첫 횃불이 켜졌습니다', '회의가 시작된 지 두 시간', '자정이 가까워질 무렵'],
    } as const;

    expect(Object.values(timelineAnchors).flat()).toHaveLength(32);
    Object.entries(timelineAnchors).forEach(([path, anchors]) => {
      const narratorLines = collectKey(readYaml(path), 'say')
        .map(asRecord)
        .filter((say) => typeof say.text === 'string' && say.char === undefined);
      anchors.forEach((anchor) => {
        const line = narratorLines.find((say) => String(say.text).includes(anchor));
        expect(line, `${path}: ${anchor}`).toBeDefined();
        expect(typeof line?.delivery, `${path}: ${anchor} narrator delivery`).toBe('string');
      });
    });

    const fullText = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    expect(fullText).not.toContain('사흘이면 됩니다');
    expect(fullText).not.toContain('전투가 끝난 저녁');
    expect(fullText).toContain('두 시간 안에 표결을 끝내겠습니다');
    expect(fullText).toContain('전투가 끝난 이튿날 · 낮');
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
    const nativeFacings = new Set<string>();
    Object.entries(characters).forEach(([name, value]) => {
      const character = asRecord(value);
      const emotions = asRecord(character.emotions);
      expect(String(character.base), name).toMatch(/-silla-v5\.webp$/);
      expect(['left', 'right', 'front'], name).toContain(character.facing);
      nativeFacings.add(String(character.facing));
      expect(Object.keys(emotions), name).toHaveLength(2);
      Object.keys(emotions).forEach((emotion) => {
        expect(spokenCharacters.has(`${name}.${emotion}`), `${name}.${emotion}`).toBe(true);
      });
    });
    expect(nativeFacings).toEqual(new Set(['left', 'right']));
  });

  it('acts out every alternate ending as a character scene before naming the ending', () => {
    const finalScenes = asRecord(readYaml('7.yaml').scenes);
    const alternateEndingIds = [
      'ending_tyrant',
      'ending_permitted',
      'ending_queen_consort',
      'ending_abdicated',
      'ending_people',
      'ending_lonely',
      'ending_one_step',
      'ending_vanished',
      'ending_broken',
    ];

    alternateEndingIds.forEach((sceneId) => {
      const actions = Array.isArray(asRecord(finalScenes[sceneId]).actions)
        ? (asRecord(finalScenes[sceneId]).actions as unknown[]).map(asRecord)
        : [];
      const endingIndex = actions.findIndex((action) => typeof action.ending === 'string');
      const leadIn = actions.slice(0, endingIndex);
      const says = leadIn.map((action) => asRecord(action.say)).filter((say) => Object.keys(say).length > 0);

      expect(endingIndex, sceneId).toBe(actions.length - 1);
      expect(says.length, sceneId).toBeGreaterThanOrEqual(3);
      expect(
        says.some((say) => typeof say.char === 'string'),
        sceneId,
      ).toBe(true);
    });
  });

  it('closes chapters with visible objects and actions instead of abstract result summaries', () => {
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const abstractTransitions = [
      '덕만은 아버지의 목숨을 구했지만',
      '결백을 되찾았지만',
      '살인 누명을 벗고',
      '국경에서 사람들을 얻었지만',
      '덕만과 진운은 처음으로',
      '이제 자신이 모은',
    ];

    abstractTransitions.forEach((sentence) => expect(allContent).not.toContain(sentence));
    expect(readFileSync(`${gameRoot}0.yaml`, 'utf8')).toContain('‘암살 용의’ 네 글자');
    expect(readFileSync(`${gameRoot}1.yaml`, 'utf8')).toContain('덕만의 이름 위를 붉은 혼인끈으로 묶고');
    expect(readFileSync(`${gameRoot}3.yaml`, 'utf8')).toContain('국경 지휘관 패를 준비해 두고 있었습니다');
    expect(readFileSync(`${gameRoot}4.yaml`, 'utf8')).toContain('빈 그릇과 보급창 열쇠');
    expect(readFileSync(`${gameRoot}5.yaml`, 'utf8')).toContain('함께 쓴 암살 조사 요구서');
    expect(readFileSync(`${gameRoot}6.yaml`, 'utf8')).toContain('첫날의 부탁 글이 접혀 있었습니다');
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

  it('uses a high-visibility gold title over the night palace artwork', () => {
    const config = readYaml('config.yaml');
    expect(asRecord(config.startScreen).titleColor).toBe('#ffe0a3');
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
      expect(String(character.base)).toMatch(/-silla-v5\.webp$/);
      expect(String(character.facing)).toMatch(/^(left|right|front)$/);
      expect(String(character.defaultDelivery)).toMatch(
        /^(neutral|calm|nervous|angry|whisper|shout|sad|deduction)$/,
      );
    });
    expect(asRecord(characters.find((character) => String(character.base).includes('deokman'))?.emotions))
      .toEqual({
        sad: 'assets/char/deokman-sad-silla-v5.webp',
        angry: 'assets/char/deokman-angry-silla-v5.webp',
      });
    expect(asRecord(characters.find((character) => String(character.base).includes('cheonmyeong'))?.emotions))
      .toEqual({
        nervous: 'assets/char/cheonmyeong-nervous-silla-v5.webp',
        sad: 'assets/char/cheonmyeong-sad-silla-v5.webp',
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
