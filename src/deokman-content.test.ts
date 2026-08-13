import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/deokman/', import.meta.url));
const synopsisPath = fileURLToPath(new URL('../docs/DEOKMAN_CINEMATIC_SYNOPSIS.ko.md', import.meta.url));
const chapters = ['0.yaml', '1.yaml', '2.yaml', '3.yaml', '4.yaml', '5.yaml', '6.yaml', '7.yaml'] as const;
const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const readYaml = (path: string): UnknownRecord => load(readFileSync(`${gameRoot}${path}`, 'utf8')) as UnknownRecord;
const rawChapter = (path: string): string => readFileSync(`${gameRoot}${path}`, 'utf8');
const stripTags = (text: unknown): string => String(text).replace(/<[^>]+>/g, '');

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

describe('Deokman cinematic reimagining', () => {
  it('resolves all eight chapters through the complete YAVN schema', () => {
    const config = parseConfigYaml(readFileSync(`${gameRoot}config.yaml`, 'utf8'), 'deokman/config.yaml');
    const base = parseBaseYaml(readFileSync(`${gameRoot}base.yaml`, 'utf8'), 'deokman/base.yaml');
    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    expect(config.data).toBeDefined();
    expect(base.data).toBeDefined();

    chapters.forEach((path) => {
      const chapter = parseChapterYaml(rawChapter(path), `deokman/${path}`);
      expect(chapter.error, path).toBeUndefined();
      expect(chapter.data, path).toBeDefined();
      if (!config.data || !base.data || !chapter.data) return;
      expect(resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data }).error, path)
        .toBeUndefined();
    });
  });

  it('keeps the complete 8 chapter, 24 choice, 35 fate, and 10 ending game promise', () => {
    const documents = chapters.map(readYaml);
    const choices = documents.flatMap((document) => collectKey(document, 'choice')).map(asRecord);
    const gameOvers = documents.flatMap((document) => collectKey(document, 'gameOver')).map(asRecord);
    const endingIds = collectKey(readYaml('7.yaml'), 'ending').map(String);

    expect(documents).toHaveLength(8);
    documents.forEach((document, chapterIndex) => {
      expect(collectKey(document, 'choice'), `${chapterIndex}.yaml`).toHaveLength(3);
    });
    expect(choices).toHaveLength(24);
    choices.forEach((choice) => expect(choice.options).toHaveLength(4));
    expect(new Set(choices.map((choice) => String(choice.key))).size).toBe(24);
    expect(gameOvers).toHaveLength(35);
    expect(new Set(gameOvers.map((gameOver) => String(gameOver.title))).size).toBe(35);
    expect(gameOvers.map((gameOver) => String(gameOver.title))).toEqual(
      Array.from({ length: 35 }, (_, index) => expect.stringContaining(`운명 ${String(index + 1).padStart(2, '0')}`)),
    );
    expect(endingIds).toHaveLength(10);
    expect(new Set(endingIds)).toEqual(new Set(Object.keys(asRecord(readYaml('config.yaml').endings))));
  });

  it('ships the authored cinematic synopsis and markets the new central conflict', () => {
    const synopsis = readFileSync(synopsisPath, 'utf8');
    const launcher = readYaml('launcher.yaml');
    const config = readYaml('config.yaml');
    const summary = String(launcher.summary);
    const seoDescription = String(asRecord(config.seo).description);

    expect(synopsis).toContain('영화적 전면 재해석 시놉시스');
    expect(synopsis).toContain('구휼 곡식을 빼돌린 귀족 연합');
    expect(synopsis).toContain('군사 지휘권과 창고 열쇠');
    expect(synopsis).toContain('비담은 사랑을 거절당해서 반란을 일으키지 않습니다');
    expect(synopsis).toContain('YAVN 연출 원칙');
    expect(summary).toContain('굶주린 마을의 곡식을 훔친 귀족 연합');
    expect(summary).toContain('16년 뒤');
    expect(summary).toContain('비담의 반란');
    expect(seoDescription).toContain('같은 권력의 거래');
    expect(asRecord(launcher.showcase).label).toBe('8 CHAPTERS · ONE CROWN');
    expect(config.version).toBe('6.0.1');
  });

  it('makes one conspiracy drive every reversal from missing grain to the final rebellion', () => {
    const causalChains = {
      '0.yaml': [
        '구휼 수레가 사라졌다는 청원서',
        '사라진 수레의 문서도 오늘 안에 가져와라',
        '왕이 장부를 펴기 전에 약이 먼저 들어가야 한다',
        '수레 끈에 묻은 가루와 같은지 대조',
        '덕만의 인장이 찍힌 약 포장지',
      ],
      '1.yaml': [
        '수레 끈의 가루도 같습니다',
        '나머지 두 대는 궁을 떠나지 않았습니다',
        '진운의 어머니가 진 빚',
        '덕만과 진운을 혼인시키고',
        '군사와 창고를 나누는 조건',
      ],
      '2.yaml': [
        '진운공 한 사람의 뜻보다 여섯 집의 합의',
        '왕실 군사의 절반',
        '제 어머니를 별채에 가두셨습니까',
        '장수와 창고지기를 여섯 집이 정한다',
        '원본 곡식 장부와 합의서의 첫 장',
      ],
      '3.yaml': [
        '칠숙공의 호위가 차는 붉은 매듭',
        '원본 곡식 장부도 그곳에 있습니까',
        '다음 왕은 남자 왕족으로 세우며',
        '원본 장부와 아진의 동생도 그 길',
        '군사와 창고를 함께 맡긴다',
      ],
      '4.yaml': [
        '바퀴 축에는 칼집',
        '북쪽 거점에서 길이 막혔다는 신호',
        '수레를 서쪽 길로 돌리라는 표시',
        '성문 안에는 이틀째 배급을 받지 못한 병사',
        '적의 기병이 곡식 수레가 늦은 틈',
      ],
      '5.yaml': [
        '원본 곡식 장부와 남자 왕 후보',
        '왕자라 부르던 귀족들은 아무도 앞으로 나오지 않았습니다',
        '제 가족을 잡고 시킬 말은 없습니다',
        '제가 증언한 날 바로 죽이려 했습니다',
        '진운을 앞세운 계획이 무너지자 오늘 밤을 고른 겁니다',
      ],
      '6.yaml': [
        '칠숙의 병사들이 왕의 방과 기록 창고를 먼저 막았습니다',
        '왕의 도장을 마지막으로 빌린 이름',
        '약 상자를 뒤집자',
        '체포 명령을 취소하고 칠숙의 군사를 해산',
        '아버지의 유언장을 들지 않았습니다',
      ],
      '7.yaml': [
        '칠숙의 옛 창고 앞에서 멈췄습니다',
        '다음 왕의 권한을 미리 나누자고 요구',
        '장수 셋과 창고지기 절반',
        '16년 전 혼인 합의서와 같은 거래',
        '합의로 열지 못한 문을 군사로 열기',
      ],
    } as const;

    Object.entries(causalChains).forEach(([path, anchors]) => {
      const text = rawChapter(path);
      let previousIndex = -1;
      anchors.forEach((anchor) => {
        const index = text.indexOf(anchor);
        expect(index, `${path}: ${anchor}`).toBeGreaterThan(previousIndex);
        previousIndex = index;
      });
    });
  });

  it('gives Jinpyeong a decisive royal register and makes him own the crown consequences', () => {
    const documents = chapters.map(readYaml);
    const kingLines = documents
      .flatMap((document) => collectKey(document, 'say'))
      .map(asRecord)
      .filter((say) => String(say.char).split('.')[0] === '진평왕')
      .map((say) => stripTags(say.text));
    const allContent = chapters.map(rawChapter).join('\n');
    const deferentialEnding = /(?:요|습니다|습니까|십시오|주세요|세요|시죠|지요)[.!?]?$/;

    expect(kingLines.length).toBeGreaterThanOrEqual(60);
    kingLines.forEach((line) => expect(line, line).not.toMatch(deferentialEnding));
    [
      '굶는 사람에게 내일은 늦다',
      '말을 꺼냈으면 끝까지 책임질 방도를 내놓아라',
      '들은 말과 본 물건을 나누어 말하라',
      '내가 듣고 싶은 답을 찾지 마라. 있었던 일을 찾아라',
      '혼인을 청한 여섯 집은 도장을 찍은 원본을 가져와라',
      '국경을 상이라 부르지 마라',
      '내가 아직 왕이다. 내 앞에서 다음 왕의 이름을 거래하지 마라',
      '그 값이 네게 누명과 칼로 돌아왔다. 내 실패다',
      '왕은 모두를 살릴 수 없다. 대신 누구를 두고 왔는지는 잊어선 안 된다',
      '내 뒤를 이을 사람은 너다. 그러나 내 이름 뒤에 숨지는 마라',
    ].forEach((anchor) => expect(allContent).toContain(anchor));
  });

  it('keeps crowned Seondeok authoritative without turning disagreement into disloyalty', () => {
    const lines = collectKey(readYaml('7.yaml'), 'say')
      .map(asRecord)
      .filter((say) => String(say.char).split('.')[0] === '덕만')
      .map((say) => stripTags(say.text));
    const deferentialEnding = /(?:요|습니다|습니까|십시오|주세요|세요|시죠|지요)[.!?]?$/;
    const finalContent = rawChapter('7.yaml');

    expect(lines.length).toBeGreaterThanOrEqual(65);
    lines.forEach((line) => expect(line, line).not.toMatch(deferentialEnding));
    expect(finalContent).toContain('지연의 책임은 내가 진다');
    expect(finalContent).toContain('반대는 죄가 아니다');
    expect(finalContent).toContain('그날 비담의 찻잔은 끝내 비어 있었습니다');
    expect(finalContent).toContain('이번에도 일이 끝난 뒤겠군요');
    expect(finalContent).toContain('듣겠다. 받아들일지는 왕이 정한다');
    expect(finalContent).toContain('마지막 결정을 내리고 그 결과를 감당할 책임');
    expect(finalContent).toContain('그러나 내 잘못이 네 반란을 지우지는 않는다');
  });

  it('uses formal honorific endings for all system-authored prose', () => {
    const documents = chapters.map(readYaml);
    const narratorLines = documents
      .flatMap((document) => collectKey(document, 'say'))
      .map(asRecord)
      .filter((say) => typeof say.text === 'string' && say.char === undefined)
      .map((say) => stripTags(say.text));
    const choicePrompts = documents
      .flatMap((document) => collectKey(document, 'choice'))
      .map(asRecord)
      .map((choice) => String(choice.prompt));
    const gameOverMessages = documents
      .flatMap((document) => collectKey(document, 'gameOver'))
      .map(asRecord)
      .map((gameOver) => String(gameOver.message));
    const endingMessages = Object.values(asRecord(readYaml('config.yaml').endings))
      .map((ending) => String(asRecord(ending).message));
    const itemDescriptions = Object.values(asRecord(readYaml('base.yaml').inventory))
      .map((item) => String(asRecord(item).description));
    const informalPlainEnding = /(^|[^니])다[.!?][’”'"]?$/;

    narratorLines.forEach((line) => expect(line, line).not.toMatch(informalPlainEnding));
    choicePrompts.forEach((prompt) => expect(prompt, prompt).toMatch(/(?:니다\.|니까\?)$/));
    [...gameOverMessages, ...endingMessages, ...itemDescriptions]
      .forEach((message) => expect(message, message).toMatch(/니다\.$/));
  });

  it('uses slow locked lines and blocking effects only for weight-bearing moments', () => {
    const documents = chapters.map(readYaml);
    const says = documents.flatMap((document) => collectKey(document, 'say')).map(asRecord);
    const locked = says.filter((say) => say.unskippable === true);
    const waits = documents.flatMap((document) => collectKey(document, 'wait'));
    const effects = documents.flatMap((document) => collectKey(document, 'effect'));
    const blocking = effects.map(asRecord).filter((effect) => effect.wait === true);
    const lockedLines = locked.map((say) => stripTags(say.text));

    expect(waits.length).toBeGreaterThanOrEqual(70);
    expect(locked).toHaveLength(15);
    expect(locked.every((say) => typeof say.char === 'string')).toBe(true);
    expect(locked.every((say) => String(say.text).includes('<speed='))).toBe(true);
    expect(lockedLines).toEqual(expect.arrayContaining([
      '내가 아직 왕이다. 내 앞에서 다음 왕의 이름을 거래하지 마라.',
      '내 뒤를 이을 사람은 너다. 그러나 내 이름 뒤에 숨지는 마라.',
      '들어라. 지금부터 신라의 왕은 덕만이다.',
      '이 문장은 거짓입니다. 그래도 사람을 모으려고 제가 쓰겠습니다.',
      '성문을 열어라. 어느 깃발 아래 있었든 다친 사람부터 살려라.',
    ]));
    expect(blocking.length).toBeGreaterThanOrEqual(10);
  });

  it('limits cinematic effects to the historical visual language', () => {
    const effects = chapters
      .flatMap((path) => collectKey(readYaml(path), 'effect'))
      .map((effect) => typeof effect === 'string' ? effect : String(asRecord(effect).name));
    const allowed = new Set(['moonveil', 'embers', 'crown', 'darken', 'focus', 'impact', 'pulse']);

    effects.forEach((effect) => expect(allowed.has(effect), effect).toBe(true));
    expect(effects).toEqual(expect.arrayContaining(['moonveil', 'embers', 'crown', 'darken', 'focus', 'impact']));
    const allContent = chapters.map(rawChapter).join('\n');
    expect(allContent).not.toMatch(/effect:\s*(?:glitch|alarm|speedlines)/);
  });

  it('never returns to the rejected self-pitying seat question or blunt villain exposition', () => {
    const allContent = chapters.map(rawChapter).join('\n');
    [
      '태어나지도 않은 왕자 때문에 제 자리는 없는 겁니까',
      '제 자리는 없는 겁니까',
      '왜 제 자리가 없습니까',
      '공주만 조용히 사라지면',
      '저는 여자가 왕이 되는 꼴을 보고 싶지 않습니다',
      '네가 왕이라면 어떻게 하겠어',
      '왜 그랬어? 그 잔에 뭐가 있었어',
      '참으로 고결하십니다',
      '대체 무엇을 왕관이라 부르십니까',
    ].forEach((phrase) => expect(allContent).not.toContain(phrase));
    expect(allContent).toContain('전례가 없다는 말은 할 수 없다는 증거가 아닙니다');
    expect(allContent).toContain('이 문장은 거짓입니다');
  });

  it('makes Jinun a willing rival and Bidam a political rebel rather than romantic devices', () => {
    const allContent = chapters.map(rawChapter).join('\n');
    [
      '되고 싶습니다. 한 번도 허락받지 못한 말이라 저도 놀랐습니다',
      '저는 왕좌를 원합니다. 그러나 어머니의 목숨과 공주의 침묵으로 산 왕좌는 받지 않겠습니다',
      '저도 왕이 될 뜻이 있습니다. 그 뜻은 지금도 바뀌지 않았습니다',
      '이번 표는 덕만공주께 드립니다',
      '그때와 달리 이번에는 다음 왕이 공개됐고 귀족도 공개된 책임을 집니다',
      '다음 왕을 제도로 묶자고 한 말은 죄가 아니다',
      '군량을 막고 칼로 답을 강요한 일',
    ].forEach((anchor) => expect(allContent).toContain(anchor));
    expect(allContent).not.toMatch(/비담.{0,40}(사랑|연모|고백|버림받)/s);
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

      expect(Object.keys(scenes).filter((sceneId) => !reached.has(sceneId)), path).toEqual([]);
    });
  });

  it('dramatizes every failed choice before presenting its fate card', () => {
    chapters.forEach((path) => {
      const scenes = asRecord(readYaml(path).scenes);
      Object.entries(scenes).forEach(([sceneId, sceneValue]) => {
        const actions = Array.isArray(asRecord(sceneValue).actions)
          ? (asRecord(sceneValue).actions as unknown[]).map(asRecord)
          : [];
        const gameOverIndex = actions.findIndex((action) => Object.keys(asRecord(action.gameOver)).length > 0);
        if (gameOverIndex < 0) return;
        const leadIn = actions.slice(0, gameOverIndex);
        const says = leadIn.map((action) => asRecord(action.say)).filter((say) => Object.keys(say).length > 0);

        expect(gameOverIndex, `${path}:${sceneId}`).toBe(actions.length - 1);
        expect(says.length, `${path}:${sceneId}`).toBeGreaterThanOrEqual(3);
        expect(says.some((say) => typeof say.char === 'string'), `${path}:${sceneId}`).toBe(true);
        expect(leadIn.some((action) => typeof action.bg === 'string'), `${path}:${sceneId}`).toBe(true);
      });
    });
  });

  it('acts all ten endings as character scenes before naming the outcome', () => {
    const scenes = asRecord(readYaml('7.yaml').scenes);
    const endingScenes = Object.entries(scenes).filter(([, sceneValue]) => collectKey(sceneValue, 'ending').length > 0);

    expect(endingScenes).toHaveLength(10);
    endingScenes.forEach(([sceneId, sceneValue]) => {
      const actions = Array.isArray(asRecord(sceneValue).actions)
        ? (asRecord(sceneValue).actions as unknown[]).map(asRecord)
        : [];
      const endingIndex = actions.findIndex((action) => typeof action.ending === 'string');
      const says = actions.slice(0, endingIndex)
        .map((action) => asRecord(action.say))
        .filter((say) => Object.keys(say).length > 0);
      expect(endingIndex, sceneId).toBe(actions.length - 1);
      expect(says.length, sceneId).toBeGreaterThanOrEqual(3);
      expect(says.some((say) => typeof say.char === 'string'), sceneId).toBe(true);
    });
  });

  it('routes representative accumulated states to all ten endings', () => {
    const verdict = asRecord(asRecord(readYaml('7.yaml').scenes).verdict);
    const branch = asRecord(collectKey(verdict, 'branch')[0]);
    const cases = Array.isArray(branch.cases) ? branch.cases.map(asRecord) : [];
    const evaluate = (conditionValue: unknown, state: UnknownRecord): boolean => {
      const condition = asRecord(conditionValue);
      if (Array.isArray(condition.all)) return condition.all.every((entry) => evaluate(entry, state));
      if (Array.isArray(condition.any)) return condition.any.some((entry) => evaluate(entry, state));
      const actual = state[String(condition.var)] ?? 0;
      const expected = condition.value;
      switch (condition.op) {
        case 'eq': return actual === expected;
        case 'neq': return actual !== expected;
        case 'gte': return Number(actual) >= Number(expected);
        case 'lte': return Number(actual) <= Number(expected);
        case 'gt': return Number(actual) > Number(expected);
        case 'lt': return Number(actual) < Number(expected);
        default: return false;
      }
    };
    const endingFor = (state: UnknownRecord): string =>
      String(cases.find((entry) => evaluate(entry.when, state))?.goto ?? branch.default);
    const clues = {
      clue_black_powder: true,
      clue_marriage_pact: true,
      clue_oath_fragment: true,
    };
    const representativeStates: UnknownRecord[] = [
      { ...clues, legitimacy: 11, insight: 5, people_support: 3, army_support: 2, rival_trust: 3 },
      { final_strategy: 'army', suspicion: 5, people_support: 3 },
      { final_strategy: 'law', nobles_support: 3, people_support: 3 },
      { final_strategy: 'alliance', rival_trust: 5, legitimacy: 12, power: 5, people_support: 3 },
      { final_strategy: 'alliance', rival_trust: 4, legitimacy: 13, bidam_trust: 4, power: 4, people_support: 3 },
      { final_strategy: 'alliance', rival_trust: 4, legitimacy: 13, bidam_trust: 3, power: 4, people_support: 3 },
      { final_strategy: 'people', people_support: 6 },
      { final_strategy: 'people', people_support: 2, sowon_trust: 1 },
      { final_strategy: 'law', nobles_support: 2, power: 4, people_support: 3 },
      { final_strategy: 'army', suspicion: 1, yushin_trust: 1, army_support: 1, legitimacy: 5, people_support: 3 },
    ];

    expect(new Set(representativeStates.map(endingFor))).toEqual(new Set([
      'ending_true',
      'ending_tyrant',
      'ending_permitted',
      'ending_queen_consort',
      'ending_vanished',
      'ending_abdicated',
      'ending_people',
      'ending_lonely',
      'ending_one_step',
      'ending_broken',
    ]));
  });

  it('anchors the 631 to 647 timeline with explicit, ordered narrator bridges', () => {
    const timelineAnchors = {
      '0.yaml': ['서기 631년 늦봄', '같은 날 밤', '다음 날 연회'],
      '1.yaml': ['연회 다음 날 아침', '수사 첫날', '둘째 날 밤', '3일째 밤'],
      '2.yaml': ['석 달이 흘러, 631년 늦여름', '그날 한낮', '해 질 무렵', '궁이 조용해진 지 두 시간쯤'],
      '3.yaml': ['631년 늦여름, 같은 날 밤', '날이 밝기 직전', '아침이 밝자'],
      '4.yaml': ['두 달 뒤, 631년 가을', '길을 나선 지 일곱째 날', '수도를 떠난 지 12일째', '도착한 다음 날 해 질 무렵', '전투 다음 날 한낮', '4일 뒤'],
      '5.yaml': ['두 달 뒤, 631년 겨울', '돌아온 지 3일째', '그날 해가 지자', '그날 밤'],
      '6.yaml': ['같은 밤, 631년 겨울', '날이 바뀌기 직전', '632년 1월 아침', '632년 1월, 덕만은 선덕왕'],
      '7.yaml': ['632년 1월', '일 년이 지나 633년 봄', '그 뒤로 아홉 해', '642년 가을', '3년 뒤인 645년', '이듬해인 646년 가을', '647년 1월'],
    } as const;

    Object.entries(timelineAnchors).forEach(([path, anchors]) => {
      const text = rawChapter(path);
      let previousIndex = -1;
      anchors.forEach((anchor) => {
        const index = text.indexOf(anchor);
        expect(index, `${path}: ${anchor}`).toBeGreaterThan(previousIndex);
        previousIndex = index;
      });
    });
  });

  it('keeps each choice and prompt compact enough for a cinematic pause', () => {
    const choices = chapters.flatMap((path) => collectKey(readYaml(path), 'choice')).map(asRecord);
    choices.forEach((choice) => {
      expect(Array.from(String(choice.prompt)).length).toBeLessThanOrEqual(32);
      const options = Array.isArray(choice.options) ? choice.options.map(asRecord) : [];
      options.forEach((option) => expect(Array.from(String(option.text)).length).toBeLessThanOrEqual(17));
    });
  });

  it('only reads or writes declared persistent state and inventory evidence', () => {
    const base = readYaml('base.yaml');
    const stateKeys = new Set(Object.keys(asRecord(base.state)));
    const inventoryKeys = new Set(Object.keys(asRecord(base.inventory)));
    const referencedState = new Set<string>();
    const acquiredItems = new Set<string>();

    chapters.forEach((path) => {
      const document = readYaml(path);
      collectKey(document, 'add').map(asRecord).forEach((entry) => Object.keys(entry).forEach((key) => referencedState.add(key)));
      collectKey(document, 'set').map(asRecord).forEach((entry) => Object.keys(entry).forEach((key) => referencedState.add(key)));
      collectKey(document, 'var').filter((value): value is string => typeof value === 'string')
        .forEach((key) => referencedState.add(key));
      collectKey(document, 'get').filter((value): value is string => typeof value === 'string')
        .forEach((key) => acquiredItems.add(key));
    });

    referencedState.forEach((key) => expect(stateKeys.has(key), key).toBe(true));
    expect(acquiredItems).toEqual(new Set(['black_powder', 'marriage_pact', 'oath_fragment']));
    acquiredItems.forEach((key) => expect(inventoryKeys.has(key), key).toBe(true));
  });

  it('preserves the existing ten characters and eleven background keys', () => {
    const base = readYaml('base.yaml');
    const assets = asRecord(base.assets);
    const characters = asRecord(assets.characters);
    const backgrounds = asRecord(assets.backgrounds);

    expect(Object.keys(characters)).toEqual([
      '덕만', '진평왕', '천명', '유신', '소원', '비담', '칠숙', '아진', '진운', '월명',
    ]);
    expect(Object.keys(backgrounds)).toEqual([
      'title_palace', 'moon_court', 'shadow_corridor', 'council_hall', 'banquet_hall',
      'princess_chamber', 'locked_room', 'throne_hall', 'frontier', 'village', 'fortress',
    ]);
    expect(new Set(Object.values(backgrounds).map(String)).size).toBeGreaterThanOrEqual(10);
    expect(Object.values(backgrounds).every((path) => String(path).includes('-silla-v3.webp'))).toBe(true);
  });

  it('uses only declared portraits and performs both expressions for every character', () => {
    const base = readYaml('base.yaml');
    const characters = asRecord(asRecord(base.assets).characters);
    const spoken = new Set(
      chapters
        .flatMap((path) => collectKey(readYaml(path), 'say'))
        .map(asRecord)
        .filter((say) => typeof say.char === 'string')
        .map((say) => String(say.char)),
    );

    Object.entries(characters).forEach(([name, value]) => {
      const character = asRecord(value);
      const emotions = asRecord(character.emotions);
      expect(Object.keys(emotions), name).toHaveLength(2);
      expect(spoken.has(name), name).toBe(true);
      Object.keys(emotions).forEach((emotion) => expect(spoken.has(`${name}.${emotion}`), `${name}.${emotion}`).toBe(true));
    });

    spoken.forEach((variant) => {
      const [name, emotion] = variant.split('.');
      expect(characters[name], name).toBeDefined();
      if (emotion) expect(asRecord(asRecord(characters[name]).emotions)[emotion], variant).toBeDefined();
    });
  });

  it('ships every visual asset and keeps the Silla art set under six megabytes', () => {
    const base = readYaml('base.yaml');
    const config = readYaml('config.yaml');
    const launcher = readYaml('launcher.yaml');
    const assets = asRecord(base.assets);
    const backgrounds = Object.values(asRecord(assets.backgrounds)).map(String);
    const characters = Object.values(asRecord(assets.characters)).map(asRecord);
    const paths = [
      ...backgrounds,
      ...characters.flatMap((character) => [String(character.base), ...Object.values(asRecord(character.emotions)).map(String)]),
      ...Object.values(asRecord(base.inventory)).map((entry) => String(asRecord(entry).image)),
      String(asRecord(config.startScreen).image),
      String(asRecord(config.endingScreen).image),
      String(launcher.thumbnail),
    ];

    paths.forEach((path) => expect(existsSync(`${gameRoot}${path}`), path).toBe(true));
    [...backgrounds, String(asRecord(config.startScreen).image), String(launcher.thumbnail)]
      .forEach((path) => expect(path).toMatch(/\.webp$/));

    const rasterAssets = new Set([
      ...backgrounds,
      ...characters.flatMap((character) => [String(character.base), ...Object.values(asRecord(character.emotions)).map(String)]),
      String(asRecord(config.seo).image),
    ]);
    const totalBytes = [...rasterAssets].reduce((total, path) => total + statSync(`${gameRoot}${path}`).size, 0);
    expect(totalBytes).toBeLessThan(6_000_000);

    characters.forEach((character) => {
      const portraits = [String(character.base), ...Object.values(asRecord(character.emotions)).map(String)];
      portraits.forEach((path) => expect(path).toMatch(/-silla-v5\.webp$/));
      const canvases = portraits.map((path) => readExtendedWebpCanvas(`${gameRoot}${path}`));
      expect(canvases.every(({ hasAlpha }) => hasAlpha)).toBe(true);
      expect(Math.max(...canvases.map(({ width }) => width)) - Math.min(...canvases.map(({ width }) => width)))
        .toBeLessThanOrEqual(2);
      expect(Math.max(...canvases.map(({ height }) => height)) - Math.min(...canvases.map(({ height }) => height)))
        .toBeLessThanOrEqual(2);
    });
  });

  it('keeps the gold title treatment and the single automatic chapter sequence', () => {
    const config = readYaml('config.yaml');
    expect(asRecord(config.startScreen).titleColor).toBe('#ffe0a3');
    chapters.slice(0, -1).forEach((path) => {
      expect(readYaml(path).script, path).toHaveLength(2);
      expect(rawChapter(path), path).not.toMatch(/goto:\s*\/\d+\.ya?ml/);
    });
  });
});
