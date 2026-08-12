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
const readExtendedWebpCanvas = (path: string): { width: number; height: number; hasAlpha: boolean } => {
  const source = readFileSync(path);
  expect(source.toString('ascii', 0, 4), path).toBe('RIFF');
  expect(source.toString('ascii', 8, 16), path).toBe('WEBPVP8X');
  return {
    width: source.readUIntLE(24, 3) + 1,
    height: source.readUIntLE(27, 3) + 1,
    hasAlpha: (source[20] & 0x10) !== 0,
  };
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
    expect(finalChapter).toContain('유신은 닫혔던 성문을 열고 밤새 죽은 군사들을 거두었다');
    expect(finalChapter).toContain('16년 전 덕만이 처음 읽었던 세 마을의 낡은 청원서');
    expect(collectKey(readYaml('7.yaml'), 'ending')).toHaveLength(10);
  });

  it('locks the authored character voices and dramatic reading rhythm', () => {
    const config = readYaml('config.yaml');
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const documents = chapters.map(readYaml);
    const waits = documents.flatMap((document) => collectKey(document, 'wait'));
    const blockingEffects = documents
      .flatMap((document) => collectKey(document, 'effect'))
      .map(asRecord)
      .filter((effect) => effect.wait === true);
    const unskippableSays = documents
      .flatMap((document) => collectKey(document, 'say'))
      .map(asRecord)
      .filter((say) => say.unskippable === true);
    const unskippableLines = unskippableSays.map((say) => String(say.text).replace(/<[^>]+>/g, ''));
    const requiredUnskippableLines = [
      '살아 있으면 결국 왕이 될 사람입니다.',
      '아버지는 한 번도 의심하지 않았다.',
      '다만 왕은 증거 없이 널 감쌀 수 없다.',
      '제가 멈추면, 다음 사람이 죽습니다.',
      '당신도, 동생도 살아 있어야 진실을 말할 수 있습니다.',
      '사람 하나를 없애고 왕이 되진 않겠습니다.',
      '일단 살아남으세요. 왕좌는 그다음에 다투죠.',
      '내 딸은 누구보다 좋은 왕이 될 수 있다.',
      '하지만 왕이 되지 않아도 내 딸이다.',
      '덕만아…… 왕보다 먼저 살아라.',
      '여왕이 아니다.',
      '신라의 왕이다.',
      '아니요. 내일도 제 옆에서 틀렸다고 말해 주세요.',
      '그래서 이번에는 제가 먼저 등을 돌렸습니다.',
      '승만과…… 성문 밖 사람들을 부탁합니다.',
    ];

    expect(config.version).toBe('5.6.0');
    expect(config.textSpeed).toBe(27);
    expect(waits.length).toBeGreaterThanOrEqual(160);
    expect(unskippableSays).toHaveLength(15);
    expect(unskippableSays.every((say) => typeof say.char === 'string')).toBe(true);
    expect(unskippableSays.every((say) => String(say.text).includes('<speed='))).toBe(true);
    expect([...unskippableLines].sort()).toEqual([...requiredUnskippableLines].sort());
    expect(blockingEffects).toHaveLength(5);
    expect(blockingEffects.map((effect) => effect.name)).toEqual(
      expect.arrayContaining(['pulse', 'impact', 'focus', 'darken', 'crown']),
    );
    expect(allContent).toContain('내 딸은 누구보다 좋은 왕이 될 수 있다');
    expect(allContent).toContain('하지만 왕이 되지 않아도 내 딸이다');
    expect(allContent).toContain('이번엔 내가 너랑 같이 들어가');
    expect(allContent).toContain('우리 쪽은 81명이 죽었습니다');
    expect(allContent).toContain('사과는 살아남고 들을게요');
    expect(allContent).toContain('그 말은 늘 반대로 들립니다');
    expect(allContent).toContain('넘어져 다치게 하란 명령은 없었습니다');
    expect(allContent).toContain('여기부터는 제가 고른 말입니다');
    expect(allContent).toContain('감옥도 겉만 화려하면 덜 무서워 보이니까요');
    expect(allContent).toContain('일단 살아남으세요. 왕좌는 그다음에 다투죠');
    expect(allContent).toContain('오늘도 신라가 먼저군요');
    expect(allContent).toContain('이번에는 제가 먼저 등을 돌렸습니다');
    expect(allContent).toContain('내게 숨기는 것이 있느냐');
    expect(allContent).toContain('오늘 창고를 연 분이 누구인지 모두 기억하겠군요');
    expect(allContent).toContain('첫 명령이다');
    expect(allContent).toContain('식량이 끊긴 곳부터 왕실 창고를 열어라');
    expect(allContent).toContain('전하, 궁문 밖이 사람들로 가득 찼습니다');
    expect(allContent).not.toContain('effect: alarm');
    expect(allContent).not.toContain('네가 왕이라면 어떻게 하겠어?');
    expect(allContent).not.toContain('왜 그랬어? 그 잔에 뭐가 있었어?');
    expect(allContent).not.toContain('전하, 궁문 밖이 사람들로 가득 찼어요');
    expect(allContent).not.toContain('제 첫 명령을 들으십시오');
    expect(allContent).not.toContain('저는 여자가 왕이 되는 꼴을 보고 싶지 않습니다');
    expect(allContent).not.toContain('공주만 조용히 사라지면 저는 원하는 남자 왕을 세울 수 있습니다');
    expect(allContent).not.toContain('참으로 고결하십니다');
    expect(allContent).not.toContain('대체 무엇을 왕관이라 부르십니까');
  });

  it('keeps every inner life readable while balancing easy words, daily chatter, and weighted lines', () => {
    const allContent = [...chapters, 'base.yaml', 'config.yaml']
      .map((path) => readFileSync(`${gameRoot}${path}`, 'utf8'))
      .join('\n');
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
      '열두 걸음',
      '일곱 숨',
      '다섯 숨',
      '두 시각',
      '두 번의 종',
      '한 걸음의 거리',
      '정월',
      '밀약',
      '지휘패',
      '신호천',
      '밀랍',
      '저잣거리',
      '고을',
      '아비',
      '오너라',
      '왕명',
      '체포령',
      '별궁',
      '후계자',
      '침상',
      '종루',
      '전갈',
      '명부',
      '승전',
      '영지',
      '동트기',
      '동이 틀',
      '동이 트',
      '포상',
      '효심',
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
    expect(allContent).toContain('귀족 대표들이 다음 왕을 정하는 귀족 회의인 화백회의');

    const visibleEmotionAnchors = [
      '하지만 왕이 되지 않아도 내 딸이다',
      '당신도, 동생도 살아 있어야 진실을 말할 수 있습니다',
      '이번엔 내가 너랑 같이 들어가',
      '어디로 가든 다른 쪽은 공주님을 원망할 겁니다',
      '그 원망은 제가 듣겠습니다',
      '낡은 비녀 하나를 진운 앞에 내려놓았다',
      '왕의 금빛 도장이 덕만의 발치로 굴러왔다',
      '오른쪽 신발 끈부터 묶으십시오',
      '세 문서 모두 덕만을 마음대로 혼인시키려는 내용이었다',
      '빈 그릇을 든 아이가 덕만의 말 앞에서 그대로 쓰러졌다',
    ];
    visibleEmotionAnchors.forEach((anchor) => expect(allContent).toContain(anchor));

    const dailyBreathers = [
      '그건 평생 안 되겠네',
      '코에 먹물 묻었어요',
      '오는 길에 흙먼지는 실컷 먹었습니다',
      '넘어져 다치게 하란 명령은 없었습니다',
      '저도 생강은 골라 냅니다',
      '발이 보여. 일곱 살 때 숨바꼭질하던 그대로야',
      '세금을 기다린 귀족들 얼굴이 아주 볼 만합니다',
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
    expect(allContent).toContain('내가 같이 떨게');
    expect(allContent).toContain('잠긴 문을 별로 안 좋아해서요');
    expect(allContent).toContain('내일도 제 옆에서 틀렸다고 말해 주세요');
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

    expect(narratorLines).toContain('등불 하나가 꺼졌다.');
    expect(narratorLines).toContain('그다음 불도 꺼졌다.');
    expect(narratorLines).toContain('신라에서는 아직 여자가 왕이 된 적이 없었다.');
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
    expect(allContent).toContain('칠숙이 그 빈 방석을 가리켰다');
    expect(allContent).not.toContain('[이찬] 칠숙');
  });

  it('lets relationships emerge through action and explains titles only when the scene needs them', () => {
    const allContent = chapters.map((path) => readFileSync(`${gameRoot}${path}`, 'utf8')).join('\n');
    const relationshipBeats = [
      '둘 다 이리 와서 내 곁에 앉아라',
      '언니는 참아져?',
      '오늘 밤은 전하 곁을 비우지 마십시오',
      '죽이지는 말라는 겁니까?',
      '내 매듭은 눈 감고도 알지?',
      '잠긴 문을 별로 안 좋아해서요',
      '진운이라 합니다. 왕실의 먼 친척입니다',
      '별자리 그림과 빈 약봉지를 가져왔습니다',
      '귀족 대표들이 다음 왕을 정하는 귀족 회의인 화백회의',
      '632년 1월, 덕만은 선덕왕이 되었다',
      '비담은 귀족 회의를 이끄는 최고 관직인 상대등에 올랐다',
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
      '언니한테 먼저 말하길 잘했어',
      '유신에게 맡기길 잘했네요',
      '이 청혼서도 가짜 노리개를 만든 사람이 꾸민 거예요',
      '거래 장부 원본을 꺼내 내밀었다',
      '저도 공주님이 돌아오실 거라 믿었습니다',
      '세 문서의 도장에 같은 흠집이 있습니다',
      '이번 표는 온전히 제 뜻입니다',
      '아직 공주님을 다 믿는 것은 아닙니다',
      '깨진 도장 두 조각',
      '비담님이 보낸 마지막 신호',
      '그 약속을 이제 내가 갚을 차례야',
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
      expect(Number(calibration.scale)).toBe(1);
      expect(Number(calibration.y)).toBe(0);
      expect(Number(calibration.spacing)).toBeGreaterThanOrEqual(0.75);
      expect(Number(calibration.spacing)).toBeLessThanOrEqual(1.25);
      expect(character.defaultFraming).toBeUndefined();
      expect(character.framings).toBeUndefined();
    });

    expect(characterPlacements.length).toBeGreaterThanOrEqual(329);
    characterPlacements.forEach((placement) => expect(placement.framing).toBeUndefined());
    expect(speakerLines.length).toBeGreaterThanOrEqual(821);
    speakerLines.forEach((say) => expect(['medium', 'close']).toContain(cameraShot(say.camera)));
    expect(new Set(speakerLines.map((say) => cameraShot(say.camera)))).toEqual(new Set(['medium', 'close']));
    speakerLines.forEach((say) => {
      const companions = Array.isArray(say.with) ? say.with : [];
      const shot = cameraShot(say.camera);
      if (companions.length >= 2) expect(shot).toBe('medium');
      if (shot === 'close') expect(companions.length).toBeLessThanOrEqual(1);
    });
    choices.forEach((choice) => {
      expect(choice.camera).toBe('close');
      expect(Array.isArray(choice.with)).toBe(true);
    });
    const backgroundCuts = sceneActionLists.flatMap((actions) =>
      actions.flatMap((action, index) => (typeof action.bg === 'string' ? [{ actions, index }] : [])),
    );
    expect(backgroundCuts.length).toBeGreaterThanOrEqual(124);
    backgroundCuts.forEach(({ actions, index }) => expect(actions[index + 1]?.camera).toBe('medium'));
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
      String(asRecord(action.say).text).includes('문이 벌컥 열렸다'),
    );
    const kingPlacements = actions.filter((action) => asRecord(action.char).id === '진평왕');

    expect(doorIndex).toBeGreaterThanOrEqual(0);
    expect(textAt(doorIndex + 1)).toContain('무슨 일이냐?');
    expect(textAt(doorIndex + 2)).toContain('펼친 청원서');
    expect(asRecord(actions[doorIndex]?.say).camera).toBe('medium');
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
    expect(say(prologue, '내일, 전하께서 두 번째 잔을').with).toEqual(['아진']);
    expect(say(prologue, '공주는 왕의 방에서 멀리 떨어져').with).toEqual(['칠숙']);
    expect(say(prologue, '덕만은 기둥 뒤로 몸을 숨겼다')).toMatchObject({ camera: 'wide', with: [] });
    expect(cameraShot(say(prologue, '덕만의 손이 청원서를 구겼다').camera)).toBe('reaction');
    expect(asRecord(say(prologue, '덕만의 손이 청원서를 구겼다').camera).target).toBe('덕만');
    expect(say(prologue, '덕만의 손이 청원서를 구겼다').with).toEqual(['덕만']);
    expect(asRecord(sceneActions('0.yaml', 'caught_choice')[0].choice).with).toEqual([]);

    const lockedRoom = sceneActions('2.yaml', 'chapter2_end');
    expect(say(lockedRoom, '말이 끝나자 문 아래로 검붉은 피').with).toEqual(['덕만', '소원']);
    expect(say(lockedRoom, '이 문은 제가 직접 잠갔어요').with).toEqual(['덕만']);
    expect(say(lockedRoom, '문을 밀자 안쪽의 무언가가').with).toEqual(['덕만', '소원']);

    const borrowedCorpse = sceneActions('3.yaml', 'go_18_borrowed_corpse');
    const chilsukRevealIndex = borrowedCorpse.findIndex(
      (action) => asRecord(action.char).id === '칠숙',
    );
    const warningIndex = borrowedCorpse.findIndex(
      (action) => String(asRecord(action.say).text).includes('사람들이 보고 있어요'),
    );
    expect(chilsukRevealIndex).toBeGreaterThan(warningIndex);

    const distantAmbush = sceneActions('5.yaml', 'go_30_martyr_prince');
    expect(say(distantAmbush, '덕만은 비탈 위에 멈췄고').with).toEqual(['덕만']);
    expect(say(distantAmbush, '공주님, 숲에 사람이 있습니다').with).toEqual([]);
    expect(say(distantAmbush, '진운공의 호위가 확인할 겁니다').with).toEqual([]);
    expect(say(distantAmbush, '알고도…… 제가 맞기를 기다렸습니까').with).toEqual(['덕만']);

    const hiddenCarriage = sceneActions('6.yaml', 'entry_procession');
    const hiddenDialogue = hiddenCarriage
      .map((action) => asRecord(action.say))
      .filter((line) => typeof line.char === 'string' && !String(line.text).includes('언니 손을 잡고'));
    hiddenDialogue.forEach((line) => expect(line.with).toEqual([]));
    expect(say(hiddenCarriage, '가마가 담장 안에').with).toEqual(['덕만', '천명']);

    const gateConfrontation = sceneActions('6.yaml', 'go_31_gate_breaker');
    expect(say(gateConfrontation, '왕궁을 공격하면 역적').with).toEqual(['덕만']);

    const warehouseDistance = sceneActions('6.yaml', 'go_32_name_in_dark');
    expect(say(warehouseDistance, '조금만 가까이 오십시오').with).toEqual(['덕만']);
    expect(say(warehouseDistance, '누가 시켰습니까').with).toEqual(['아진']);
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
      ['0.yaml', 'prologue_open', 'p_caught', '살아 있으면 결국 왕이 될 사람입니다'],
      ['0.yaml', 'warn_choice', 'p_warn', '누군가는 불러야 해'],
      ['0.yaml', 'banquet_choice', 'p_cup', '위험하면 내 손부터 잡아라'],
      ['1.yaml', 'chapter1_open', 'c1_investigate', '거짓말한 사람부터 찾죠'],
      ['1.yaml', 'rumor_choice', 'c1_rumor', '소문이 틀렸다고 나서는 사람'],
      ['1.yaml', 'evidence_choice', 'c1_evidence', '칠숙공 이름을 대는 순간'],
      ['2.yaml', 'chapter2_open', 'c2_suitor', '그 선택을 할지는 제가 정합니다'],
      ['2.yaml', 'reputation_choice', 'c2_reputation', '이번에도 마음 편한 답은 없군요'],
      ['2.yaml', 'throne_choice', 'c2_throne', '아버지는 늘 제게 선택만 남기시네요'],
      ['3.yaml', 'chapter3_open', 'c3_body', '둘이 봤잖아요. 그러니 끝까지 같이 있어요'],
      ['3.yaml', 'testimony_choice', 'c3_testimony', '거짓말하기 어려운 흔적부터 보죠'],
      ['3.yaml', 'culprit_choice', 'c3_culprit', '당신도, 동생도 살아 있어야'],
      ['4.yaml', 'chapter4_open', 'c4_grain', '흙먼지는 끼니가 아닙니다'],
      ['4.yaml', 'defense_choice', 'c4_defense', '그 원망은 제가 듣겠습니다'],
      ['4.yaml', 'enemy_choice', 'c4_enemy', '넘어져 다치게 하란 명령'],
      ['5.yaml', 'chapter5_open', 'c5_contest', '아무에게도 말하지 않겠습니다'],
      ['5.yaml', 'leverage_choice', 'c5_leverage', '이번만은 대가 없이 해 주세요'],
      ['5.yaml', 'rescue_choice', 'c5_rescue', '일단 살아남으세요'],
      ['6.yaml', 'chapter6_open', 'c6_entry', '내가 너랑 같이 들어가'],
      ['6.yaml', 'rescue_choice', 'c6_rescue', '늦어도 제가 고르겠습니다'],
      ['6.yaml', 'seal_found', 'c6_seal', '오늘은 먼저 살아남고요'],
      ['7.yaml', 'final_open', 'final_opening', '왕이 된 뒤 처음 나서는 길'],
      ['7.yaml', 'proof_choice', 'final_proof', '오늘 먼저 움직일 곳을 정하셔야 합니다'],
      ['7.yaml', 'crown_choice_report', 'final_crown', '승만공주를 다음 왕으로 정하는 문서'],
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
      ['0.yaml', 'prologue_open', '언젠가 태어날 왕자를 위해 비워 둔 자리입니다'],
      ['1.yaml', 'chapter1_open', '노리개가 덕만 발치까지 굴렀다'],
      ['2.yaml', 'chapter2_open', '혼인하면 제 말도 남편 허락을 받아야 합니까'],
      ['3.yaml', 'chapter3_open', '덕만이 문을 밀어젖히자'],
      ['4.yaml', 'chapter4_open', '빈 그릇을 든 아이가 덕만의 말 앞에서'],
      ['5.yaml', 'chapter5_open', '저는 왕자가 아닙니다'],
      ['6.yaml', 'chapter6_open', '덕만을 잡으라는 명령이 빗물도 마르기 전에'],
      ['7.yaml', 'final_open', '세 지역으로 갈 곡식 수레가 3일째'],
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
      '0.yaml': ['서기 631년 늦봄', '같은 날, 밤이 깊은 시각', '다음 날, 예정된 연회가 열렸다'],
      '1.yaml': ['연회 다음 날 아침', '수사 첫날, 해가 서쪽 담장', '3일째 새벽', '3일째 밤'],
      '2.yaml': ['석 달이 흘러, 631년 늦여름', '그날 한낮', '해 질 무렵', '궁이 조용해진 지 두 시간쯤'],
      '3.yaml': ['631년 늦여름, 같은 날 밤', '날이 밝기 직전', '날이 밝을 무렵', '아침이 밝자'],
      '4.yaml': ['두 달 뒤, 631년 가을', '수도를 떠난 지 12일째 되는 날', '도착한 다음 날 해 질 무렵', '전투 다음 날 한낮', '4일 뒤'],
      '5.yaml': ['두 달 뒤, 631년 겨울', '수도로 돌아온 지 3일째', '그날 해가 지자', '그날 밤'],
      '6.yaml': ['같은 밤, 631년 겨울', '날이 바뀌기 직전', '632년 1월 아침', '632년 1월, 덕만은 선덕왕'],
      '7.yaml': ['632년 1월, 왕이 된 지 3일째', '일 년이 지나 633년 봄', '그 뒤로 아홉 해가 흘렀다', '642년 가을, 왕이 된 지 11년째', '3년 뒤인 645년', '그로부터 2년이 더 지난 647년 1월'],
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
    expect(fullText).toContain('그 뒤로 아홉 해가 흘렀다');
    expect(fullText).toContain('647년 1월');
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
      const portraitCanvases = [character.base, ...Object.values(emotions)].map((path) =>
        readExtendedWebpCanvas(`${gameRoot}${String(path)}`),
      );
      expect(portraitCanvases.every(({ hasAlpha }) => hasAlpha), name).toBe(true);
      const widths = portraitCanvases.map(({ width }) => width);
      const heights = portraitCanvases.map(({ height }) => height);
      expect(Math.max(...widths) - Math.min(...widths), name).toBeLessThanOrEqual(2);
      expect(Math.max(...heights) - Math.min(...heights), name).toBeLessThanOrEqual(2);
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
    expect(readFileSync(`${gameRoot}0.yaml`, 'utf8')).toContain('‘왕을 죽이려 한 사람, 덕만.’');
    expect(readFileSync(`${gameRoot}1.yaml`, 'utf8')).toContain('세 문서 모두 덕만을 마음대로 혼인시키려는 내용이었다');
    expect(readFileSync(`${gameRoot}3.yaml`, 'utf8')).toContain('칠숙은 이미 국경 지휘권이 적힌 나무패를 꺼내 들고 있었다');
    expect(readFileSync(`${gameRoot}4.yaml`, 'utf8')).toContain('아이의 빈 그릇과 창고 열쇠');
    expect(readFileSync(`${gameRoot}5.yaml`, 'utf8')).toContain('비에 젖은 체포 명령');
    expect(readFileSync(`${gameRoot}6.yaml`, 'utf8')).toContain('식량이 끊긴 곳부터 왕실 창고를 열어라');
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
