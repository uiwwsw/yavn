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
const cameraShot = (value: unknown): string => {
  if (typeof value === 'string') return value;
  return String(asRecord(value).shot ?? '');
};

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

  it('markets the central dramatic incident before props or branching mechanics', () => {
    const launcher = readYaml('launcher.yaml');
    const config = readYaml('config.yaml');
    const summary = String(launcher.summary);
    const showcase = asRecord(launcher.showcase);
    const seo = asRecord(config.seo);

    expect(summary).toContain('아버지를 살리고도 암살범으로 몰린 덕만');
    expect(summary).toContain('신라 최초의 여왕');
    expect(summary).not.toMatch(/누룽지|선택|엔딩|\d+개/);
    expect(showcase.label).toBe('8 CHAPTERS · ONE CROWN');
    expect(launcher.tags).toEqual([
      'historical-fiction',
      'silla',
      'character-drama',
      'court-intrigue',
      'political-thriller',
    ]);
    expect(String(seo.description)).toContain('암살범으로 몰린 덕만');
    expect(String(seo.description)).not.toMatch(/선택|엔딩|\d+개/);
  });

  it('defines ten collectible endings including the locked true ending line', () => {
    const config = readYaml('config.yaml');
    expect(Object.keys(asRecord(config.endings))).toHaveLength(10);
    const coronationChapter = readFileSync(`${gameRoot}6.yaml`, 'utf8');
    const finalChapter = readFileSync(`${gameRoot}7.yaml`, 'utf8');
    expect(coronationChapter).toContain('<speed=17>여왕이 아니다.</speed>');
    expect(coronationChapter).toContain('<speed=18>신라의 왕이다.</speed>');
    expect(finalChapter).toContain('유신은 성문을 열고 죽은 군사들을 거두었습니다');
    expect(finalChapter).toContain('왕좌 곁에는 세 마을의 낡은 청원이 남아 있었습니다');
    expect(collectKey(readYaml('7.yaml'), 'ending')).toHaveLength(10);
  });

  it('locks the authored character voices and dramatic reading rhythm', () => {
    const config = readYaml('config.yaml');
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const documents = chapters.map(readYaml);
    const waits = documents.flatMap((document) => collectKey(document, 'wait'));

    expect(config.version).toBe('5.3.0');
    expect(config.textSpeed).toBe(27);
    expect(waits.length).toBeGreaterThanOrEqual(10);
    expect(allContent).toContain('내 딸은 왕이 될 수 있다');
    expect(allContent).toContain('왕이 아니어도 내 딸이다');
    expect(allContent).toContain('이번엔 같이 들어가');
    expect(allContent).toContain('우리 전사자는 여든하나입니다');
    expect(allContent).toContain('사과는 살아남고 들을게요');
    expect(allContent).toContain('그 말은 늘 반대로 들립니다');
    expect(allContent).toContain('넘어져 다치게 하란 명령은 없었습니다');
    expect(allContent).toContain('여기부터는 제 말입니다');
    expect(allContent).toContain('칼보다 비단이 보기 좋지요');
    expect(allContent).toContain('양보는 살아서 거절하세요');
    expect(allContent).toContain('또 신라가 먼저군요');
    expect(allContent).toContain('이번엔 제가 먼저 등을 돌렸습니다');
    expect(allContent).not.toContain('저는 여자가 왕이 되는 꼴을 보고 싶지 않습니다');
    expect(allContent).not.toContain('공주만 조용히 사라지면 저는 원하는 남자 왕을 세울 수 있습니다');
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
      '공모',
      '암살 용의',
      '보폭',
      '비축',
      '별점표',
      '징조',
      '전례',
      '계승',
      '정통성',
      '위조 유언장',
    ];
    hardPhrases.forEach((phrase) => expect(allContent).not.toContain(phrase));
    const rejectedDraftPhrases = [
      '왕실 제사 순서와 굶주린 세 마을',
      '위험을 숫자로 재는 젊은 장수',
      '진운의 약점을 어떻게 다룰까',
      '누구의 하루인지는 정하셔야 합니다',
      '결정 뒤엔 죽부터 드십시오',
      '이제 명령이 안 들을 수도 있습니다',
      '신라는 왕을 얻고, 왕은 선택할 권리를 잃었습니다',
    ];
    rejectedDraftPhrases.forEach((phrase) => expect(allContent).not.toContain(phrase));
    expect(allContent).toContain('높은 귀족들이 나라의 앞날을 정하는 화백회의');

    const visibleEmotionAnchors = [
      '왕이 아니어도 내 딸이다',
      '당신과 동생, 둘 다 살릴 겁니다',
      '이번엔 같이 들어가',
      '어느 쪽을 택해도 원망을 듣게 될 겁니다',
      '그 원망도 제가 받아야죠',
      '낡은 비녀를 내려놨습니다',
      '금빛 도장이 바닥을 굴렀습니다',
      '오른쪽 신발 끈이 풀렸습니다',
      '문서마다 덕만의 이름이 붉은 실로 매여 있었습니다',
      '빈 그릇을 든 아이가 성문 앞에 쓰러졌습니다',
    ];
    visibleEmotionAnchors.forEach((anchor) => expect(allContent).toContain(anchor));

    const dailyBreathers = [
      '그건 좀 어렵겠네',
      '코에 먹물 묻었어요',
      '오는 길에 흙먼지는 실컷 먹었습니다',
      '넘어져 다치게 하란 명령은 없었습니다',
      '저도 생강은 골라 냅니다',
      '발이 보여. 일곱 살 때랑 똑같아',
      '귀족들 얼굴이 아주 볼 만합니다',
    ];
    dailyBreathers.forEach((anchor) => {
      const line = allContent.split('\n').find((candidate) => candidate.includes(anchor));
      expect(line, anchor).toBeDefined();
      expect(line).not.toContain('<speed=');
    });

    const weightedSegments = allContent.match(/<speed=(?:1[7-9]|2[0-2])>/g) ?? [];
    expect(weightedSegments.length).toBeGreaterThanOrEqual(20);
  });

  it('keeps every spoken balloon concise and clear for Korean teen readers', () => {
    const spokenLines = chapters.flatMap((path) => collectKey(readYaml(path), 'say'))
      .map(asRecord)
      .filter((entry) => typeof entry.char === 'string')
      .map((entry) => String(entry.text).replace(/<[^>]+>/g, ''));
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');

    expect(spokenLines.length).toBeGreaterThanOrEqual(821);
    spokenLines.forEach((line) => expect(Array.from(line).length, line).toBeLessThanOrEqual(32));
    expect(allContent).toContain('나도 같이 무서울게');
    expect(allContent).toContain('잠긴 문을 별로 안 좋아해서요');
    expect(allContent).toContain('내일도 같이 틀려 주세요');
  });

  it('gives narrator boxes one readable breath while varying short beats and fuller context', () => {
    const narratorLines = chapters.flatMap((path) => collectKey(readYaml(path), 'say'))
      .map(asRecord)
      .filter((entry) => typeof entry.text === 'string' && entry.char === undefined)
      .map((entry) => String(entry.text).replace(/<[^>]+>/g, ''));

    expect(narratorLines.filter((line) => Array.from(line).length <= 20).length).toBeGreaterThanOrEqual(50);
    expect(narratorLines.filter((line) => Array.from(line).length >= 40).length).toBeGreaterThanOrEqual(15);
    narratorLines.forEach((line) => {
      expect(Array.from(line).length, line).toBeLessThanOrEqual(60);
      expect((line.match(/[.!?]/g) ?? []).length, line).toBeLessThanOrEqual(2);
      expect(line, line).not.toMatch(/하면.+하면|고르면.+고르면/);
    });

    expect(narratorLines).toContain('등불 하나가 꺼졌습니다.');
    expect(narratorLines).toContain('그다음 불도 꺼졌습니다.');
    expect(narratorLines).toContain('그때까지 신라의 왕좌에 여자 이름이 오른 적은 없었습니다.');
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
    expect(allContent).toContain('칠숙은 왕자에게 비워 둔 방석을 가리켰습니다');
    expect(allContent).not.toContain('[이찬] 칠숙');
  });

  it('lets relationships emerge through action and explains titles only when the scene needs them', () => {
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const relationshipBeats = [
      '둘 다 내 딸이다',
      '언니는 참을 수 있어',
      '칠숙공입니다. 왕의 곁을 비우지 마십시오',
      '죽입니까?',
      '내 옷은 눈 감고도 묶지',
      '잠긴 문을 별로 안 좋아해서요',
      '진운이라 합니다. 왕실과는 먼 친척입니다',
      '별자리 그림과 빈 약봉지를 가져왔습니다',
      '높은 귀족들이 나라의 앞날을 정하는 화백회의',
      '632년 정월, 덕만은 선덕왕이 되었습니다',
      '그날 비담은 귀족 회의를 이끄는 상대등이 되었습니다',
    ];

    relationshipBeats.forEach((beat) => expect(allContent).toContain(beat));
    expect(allContent).not.toMatch(/\[(?:왕|공주|이찬|호위장|무사|시녀|왕족|왕실 치료자|상대등)\]/);
    expect(allContent).not.toContain('이 게임은 대화를');
    expect(allContent).not.toContain('당신은 훗날');
    expect(allContent).not.toContain('오늘의 선택은');
  });

  it('turns every persistent relationship and clue into a later visible consequence', () => {
    const baseState = Object.keys(asRecord(readYaml('base.yaml').state)).sort();
    const readState = [...new Set(chapters.flatMap((path) => collectKey(readYaml(path), 'var'))
      .filter((key): key is string => typeof key === 'string'))].sort();
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const callbackAnchors = [
      '언니에게 말하길 잘했네요',
      '명단을 맡기길 잘했어요',
      '이것도 같은 손이 묶었어요',
      '거래 장부의 사본이 아니라 원본',
      '저도 공주의 귀환을 믿었습니다',
      '세 문서에 찍힌 도장의 흠집이 모두 같습니다',
      '이번 표는 제 뜻입니다',
      '아직 공주를 믿는 건 아닙니다',
      '깨진 도장 두 조각',
      '비담님이 보낸 마지막 암호',
      '그 약속, 이제 내가 갚을 차례야',
    ];

    expect(readState).toEqual(baseState);
    expect(baseState).not.toContain('saved_rival');
    callbackAnchors.forEach((anchor) => expect(allContent).toContain(anchor));
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
      expect(Number(calibration.spacing)).toBeGreaterThanOrEqual(0.75);
      expect(Number(calibration.spacing)).toBeLessThanOrEqual(1.25);
      expect(character.defaultFraming).toBeUndefined();
      expect(character.framings).toBeUndefined();
    });

    expect(characterPlacements.length).toBeGreaterThanOrEqual(329);
    characterPlacements.forEach((placement) => expect(placement.framing).toBeUndefined());
    expect(speakerLines.length).toBeGreaterThanOrEqual(821);
    speakerLines.forEach((say) => expect(['wide', 'medium', 'close']).toContain(cameraShot(say.camera)));
    expect(new Set(speakerLines.map((say) => cameraShot(say.camera)))).toEqual(new Set(['wide', 'medium', 'close']));
    speakerLines.forEach((say) => {
      const companions = Array.isArray(say.with) ? say.with : [];
      const shot = cameraShot(say.camera);
      if (companions.length >= 2) expect(shot).toBe('wide');
      if (shot === 'medium' || shot === 'close') expect(companions.length).toBeLessThanOrEqual(1);
    });
    choices.forEach((choice) => {
      expect(choice.camera).toBe('close');
      expect(Array.isArray(choice.with)).toBe(true);
    });
    const backgroundCuts = sceneActionLists.flatMap((actions) =>
      actions.flatMap((action, index) => (typeof action.bg === 'string' ? [{ actions, index }] : [])),
    );
    expect(backgroundCuts.length).toBeGreaterThanOrEqual(124);
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

  it('holds Deokman in place during the coronation declaration', () => {
    const scenes = asRecord(readYaml('6.yaml').scenes);
    const actions = Array.isArray(asRecord(scenes.coronation_finish).actions)
      ? (asRecord(scenes.coronation_finish).actions as unknown[]).map(asRecord)
      : [];
    const declarationIndex = actions.findIndex((action) =>
      String(asRecord(action.say).text).includes('여왕이 아니다'),
    );
    const latestPlacement = actions
      .slice(0, declarationIndex)
      .map((action) => asRecord(action.char))
      .filter((placement) => placement.id === '덕만')
      .at(-1);
    const declaration = asRecord(actions[declarationIndex]?.say);
    const camera = asRecord(declaration.camera);

    expect(latestPlacement?.position).toBe('left');
    expect(actions.slice(Math.max(0, declarationIndex - 2), declarationIndex)
      .some((action) => asRecord(action.char).id === '덕만')).toBe(false);
    expect(camera).toMatchObject({ shot: 'close', target: 'speaker', transition: 'cut' });
  });

  it('turns the wet official arrival into an acted interruption without restaging the king', () => {
    const scenes = asRecord(readYaml('0.yaml').scenes);
    const actions = Array.isArray(asRecord(scenes.prologue_open).actions)
      ? (asRecord(scenes.prologue_open).actions as unknown[]).map(asRecord)
      : [];
    const textAt = (index: number) => String(asRecord(actions[index]?.say).text);
    const doorIndex = actions.findIndex((action) =>
      String(asRecord(action.say).text).includes('문이 벌컥 열렸습니다'),
    );
    const kingPlacements = actions.filter((action) => asRecord(action.char).id === '진평왕');

    expect(doorIndex).toBeGreaterThanOrEqual(0);
    expect(textAt(doorIndex + 1)).toContain('무슨 일인가?');
    expect(textAt(doorIndex + 2)).toContain('젖은 청원서');
    expect(asRecord(actions[doorIndex]?.say).camera).toBe('wide');
    expect(asRecord(actions[doorIndex]?.say).with).toEqual(['진평왕', '덕만', '칠숙']);
    expect(asRecord(actions[doorIndex + 1]?.say).with).toEqual(['덕만', '칠숙']);
    expect(kingPlacements).toHaveLength(1);
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
      const characterPlacements = leadIn
        .map((action) => asRecord(action.char))
        .filter((placement) => typeof placement.id === 'string');
      const decisiveCloseups = says.filter(
        (say) => say.camera === 'close' && Array.isArray(say.with),
      );

      expect(gameOverIndex, `${path}:${sceneId}`).toBe(actions.length - 1);
      expect(says.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(6);
      expect(
        new Set(says
          .map((say) => say.char)
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.split('.')[0])).size,
        `${path}:${sceneId}`,
      ).toBeGreaterThanOrEqual(2);
      expect(characterPlacements.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(2);
      characterPlacements.forEach((placement) => expect(placement.framing).toBeUndefined());
      expect(leadIn.some((action) => typeof action.effect === 'string'), `${path}:${sceneId}`).toBe(true);
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
    expect(say(prologue, '내일, 왕은 두 번째 잔').with).toEqual(['아진']);
    expect(say(prologue, '공주는 왕보다 열두 걸음').with).toEqual(['칠숙']);
    expect(say(prologue, '덕만은 기둥 뒤로 숨었습니다')).toMatchObject({ camera: 'wide', with: [] });
    expect(cameraShot(say(prologue, '덕만은 놀란 숨을 삼켰습니다').camera)).toBe('reaction');
    expect(asRecord(say(prologue, '덕만은 놀란 숨을 삼켰습니다').camera).target).toBe('덕만');
    expect(say(prologue, '덕만은 놀란 숨을 삼켰습니다').with).toEqual(['덕만']);
    expect(asRecord(sceneActions('0.yaml', 'caught_choice')[0].choice).with).toEqual([]);

    const lockedRoom = sceneActions('2.yaml', 'chapter2_end');
    expect(say(lockedRoom, '문 아래로 검붉은 피').with).toEqual(['덕만', '소원']);
    expect(say(lockedRoom, '방은 제가 잠갔어요').with).toEqual(['덕만']);
    expect(say(lockedRoom, '문을 밀자 안쪽에 쓰러진 몸이').with).toEqual(['덕만', '소원']);

    const borrowedCorpse = sceneActions('3.yaml', 'go_18_borrowed_corpse');
    const chilsukRevealIndex = borrowedCorpse.findIndex(
      (action) => asRecord(action.char).id === '칠숙',
    );
    const warningIndex = borrowedCorpse.findIndex(
      (action) => String(asRecord(action.say).text).includes('사람들이 봤어요'),
    );
    expect(chilsukRevealIndex).toBeGreaterThan(warningIndex);

    const distantAmbush = sceneActions('5.yaml', 'go_30_martyr_prince');
    expect(say(distantAmbush, '덕만은 비탈 위').with).toEqual(['덕만']);
    expect(say(distantAmbush, '숲에 사람이 있습니다').with).toEqual([]);
    expect(say(distantAmbush, '그대 호위가 처리할 일').with).toEqual([]);
    expect(say(distantAmbush, '알고도…… 기다렸습니까').with).toEqual(['덕만']);

    const hiddenCarriage = sceneActions('6.yaml', 'entry_procession');
    const hiddenDialogue = hiddenCarriage
      .map((action) => asRecord(action.say))
      .filter((line) => typeof line.char === 'string' && !String(line.text).includes('언니 손을 잡고'));
    hiddenDialogue.forEach((line) => expect(line.with).toEqual([]));
    expect(say(hiddenCarriage, '가마가 담장 안에').with).toEqual(['덕만', '천명']);

    const gateConfrontation = sceneActions('6.yaml', 'go_31_gate_breaker');
    expect(say(gateConfrontation, '궁을 친 자를 역적').with).toEqual(['덕만']);

    const warehouseDistance = sceneActions('6.yaml', 'go_32_name_in_dark');
    expect(say(warehouseDistance, '가까이 오십시오').with).toEqual(['덕만']);
    expect(say(warehouseDistance, '누구입니까').with).toEqual(['아진']);
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
      ['0.yaml', 'prologue_open', 'p_caught', '살아 있으면 왕이 됩니다'],
      ['0.yaml', 'warn_choice', 'p_warn', '한 사람은 믿어야 해'],
      ['0.yaml', 'banquet_choice', 'p_cup', '위험하면 내 손을 잡아라'],
      ['1.yaml', 'chapter1_open', 'c1_investigate', '누가 거짓말했는지부터 찾죠'],
      ['1.yaml', 'rumor_choice', 'c1_rumor', '그 말을 바로잡으려 달려드는 자'],
      ['1.yaml', 'evidence_choice', 'c1_evidence', '당신 이름을 말하면 죽겠죠'],
      ['2.yaml', 'chapter2_open', 'c2_suitor', '도망칠지는 제가 정하죠'],
      ['2.yaml', 'reputation_choice', 'c2_reputation', '어떤 수를 써도 누군가는 다치겠군요'],
      ['2.yaml', 'throne_choice', 'c2_throne', '왕은 참 나쁜 아버지네요'],
      ['3.yaml', 'chapter3_open', 'c3_body', '둘이 봤으면 둘이 끝까지'],
      ['3.yaml', 'testimony_choice', 'c3_testimony', '하나를 끝까지 따라가죠'],
      ['3.yaml', 'culprit_choice', 'c3_culprit', '당신과 동생, 둘 다 살릴'],
      ['4.yaml', 'chapter4_open', 'c4_grain', '절대로요'],
      ['4.yaml', 'defense_choice', 'c4_defense', '그 원망도 제가 받아야죠'],
      ['4.yaml', 'enemy_choice', 'c4_enemy', '넘어져 다치게 하란 명령'],
      ['5.yaml', 'chapter5_open', 'c5_contest', '그건 기록하지 않겠습니다'],
      ['5.yaml', 'leverage_choice', 'c5_leverage', '대가 없이 해 줘요'],
      ['5.yaml', 'rescue_choice', 'c5_rescue', '양보는 살아서 거절하세요'],
      ['6.yaml', 'chapter6_open', 'c6_entry', '이번엔 같이 들어가'],
      ['6.yaml', 'rescue_choice', 'c6_rescue', '아뇨. 제가 고르겠습니다'],
      ['6.yaml', 'seal_found', 'c6_seal', '오늘은 먼저 살아남고요'],
      ['7.yaml', 'final_open', 'final_opening', '왕이 된 뒤 첫걸음'],
      ['7.yaml', 'proof_choice', 'final_proof', '먼저 움직일 곳을 정하셔야 합니다'],
      ['7.yaml', 'crown_choice_report', 'final_crown', '승만공주께 보낼 문서도 필요'],
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
        const destinations = (candidateActions: UnknownRecord[]) => candidateActions.flatMap((action) => {
          const branch = asRecord(action.branch);
          const cases = Array.isArray(branch.cases) ? branch.cases.map(asRecord) : [];
          return [
            ...(typeof action.goto === 'string' ? [action.goto] : []),
            ...cases.map((branchCase) => branchCase.goto).filter((goto): goto is string => typeof goto === 'string'),
            ...(typeof branch.default === 'string' ? [branch.default] : []),
          ];
        });
        const reachesChoice = (candidateSceneId: string, visited = new Set<string>()): boolean => {
          if (candidateSceneId === choiceSceneId) return true;
          if (visited.has(candidateSceneId)) return false;
          visited.add(candidateSceneId);
          const candidateScene = asRecord(scenes[candidateSceneId]);
          const candidateActions = Array.isArray(candidateScene.actions)
            ? candidateScene.actions.map(asRecord)
            : [];
          return destinations(candidateActions).some((nextSceneId) => reachesChoice(nextSceneId, new Set(visited)));
        };
        const routesAfterContext = destinations(actions.slice(anchorIndex + 1));
        expect(
          routesAfterContext.some((nextSceneId) => reachesChoice(nextSceneId)),
          `${path}:${sceneId} -> ${choiceSceneId}`,
        ).toBe(true);
      }
    });
  });

  it('shows each chapter premise through an enacted visual-novel episode instead of a setting summary', () => {
    const episodeAnchors = [
      ['0.yaml', 'prologue_open', '왕자께서 앉으실 자리가 비어 있습니다'],
      ['1.yaml', 'chapter1_open', '피 묻은 연꽃 노리개가 바닥을 굴렀습니다'],
      ['2.yaml', 'chapter2_open', '제 입까지 혼수로 달라는군요'],
      ['3.yaml', 'chapter3_open', '덕만이 문을 밀어 부수자'],
      ['4.yaml', 'chapter4_open', '빈 그릇을 든 아이가 성문 앞에 쓰러졌습니다'],
      ['5.yaml', 'chapter5_open', '왕자가 아닙니다'],
      ['6.yaml', 'chapter6_open', '모든 궁문에 덕만의 체포령이 붙었습니다'],
      ['7.yaml', 'final_open', '곡식이 끊겼답니다'],
    ] as const;
    const forbiddenSummaries = [
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
      '0.yaml': ['서기 631년 늦봄', '631년 늦봄, 같은 날 밤', '이튿날 아침'],
      '1.yaml': ['연회 다음 날 아침', '첫째 날 해 질 무렵', '사흘째 새벽', '사흘째 밤'],
      '2.yaml': ['석 달 뒤, 631년 늦여름', '그날 한낮', '그날 해 질 무렵', '같은 날, 밤이 깊었습니다'],
      '3.yaml': ['631년 늦여름, 같은 날 밤', '이튿날 새벽 직전', '동틀 무렵', '이튿날 아침'],
      '4.yaml': ['두 달 뒤, 631년 가을', '수도를 떠난 지 열이틀째', '도착 이튿날 해 질 무렵', '전투 다음 날 한낮', '나흘 뒤'],
      '5.yaml': ['두 달 뒤, 631년 겨울', '수도로 돌아온 지 사흘째', '그날 해가 진 뒤', '그날 밤'],
      '6.yaml': ['같은 밤, 631년 겨울', '날이 바뀌기 직전', '632년 정월 아침', '632년 정월, 덕만은 선덕왕'],
      '7.yaml': ['632년 정월, 왕이 된 지 사흘째', '왕이 된 지 한 해가 지난 633년 봄', '그 뒤로 아홉 해', '642년 가을, 왕위에 오른 지 11년째', '그로부터 세 해 뒤인 645년', '그로부터 두 해 뒤, 647년 정월'],
    } as const;

    expect(Object.values(timelineAnchors).flat()).toHaveLength(34);
    Object.entries(timelineAnchors).forEach(([path, anchors]) => {
      const rawText = readFileSync(`${gameRoot}${path}`, 'utf8');
      const narratorLines = collectKey(readYaml(path), 'say')
        .map(asRecord)
        .filter((say) => typeof say.text === 'string' && say.char === undefined);
      let previousIndex = -1;
      anchors.forEach((anchor) => {
        const line = narratorLines.find((say) => String(say.text).includes(anchor));
        expect(line, `${path}: ${anchor}`).toBeDefined();
        const currentIndex = rawText.indexOf(anchor);
        expect(currentIndex, `${path}: ${anchor}`).toBeGreaterThan(previousIndex);
        previousIndex = currentIndex;
      });
    });

    const fullText = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    expect(fullText).not.toContain('사흘이면 됩니다');
    expect(fullText).not.toContain('전투가 끝난 저녁');
    expect(fullText).not.toContain('10년 뒤, 642년');
    expect(fullText).toContain('그 뒤로 아홉 해가 흘렀습니다');
    expect(fullText).toContain('647년 정월');
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
    expect(readFileSync(`${gameRoot}0.yaml`, 'utf8')).toContain('‘왕을 죽이려 한 자, 덕만.’');
    expect(readFileSync(`${gameRoot}1.yaml`, 'utf8')).toContain('문서마다 덕만의 이름이 붉은 실로 매여 있었습니다');
    expect(readFileSync(`${gameRoot}3.yaml`, 'utf8')).toContain('국경 지휘패를 준비해 뒀습니다');
    expect(readFileSync(`${gameRoot}4.yaml`, 'utf8')).toContain('빈 그릇과 성의 창고 열쇠');
    expect(readFileSync(`${gameRoot}5.yaml`, 'utf8')).toContain('젖은 체포 명령');
    expect(readFileSync(`${gameRoot}6.yaml`, 'utf8')).toContain('굶는 고을의 창고부터 여세요');
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
