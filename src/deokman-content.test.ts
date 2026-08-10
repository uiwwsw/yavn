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

    expect(config.version).toBe('2.0.0');
    expect(config.textSpeed).toBe(27);
    expect(waits.length).toBeGreaterThanOrEqual(10);
    expect(allContent).toContain('나를 지운 뒤에도, 오늘 밤 신라를 지킬 수 있습니까');
    expect(allContent).toContain('아비가 세운 딸은 아비와 함께 무너진다');
    expect(allContent).toContain('열병이 났던 밤, 네 손을 너무 세게 잡아 손톱 자국을 냈지');
    expect(allContent).toContain('우리 전사자는 여든하나입니다');
    expect(allContent).toContain('다른 건 이 행주뿐이에요');
    expect(allContent).toContain('어떤 거짓말을 안주로 내시겠습니까');
    expect(allContent).toContain('참으로 고결하십니다');
    expect(allContent).toContain('강가까지 서른두 걸음');
    expect(allContent).toContain('창 하나, 문 하나, 호위 여섯');
    expect(allContent).toContain('마른 우물도 사흘은 하늘을 비춥니다');
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

    expect(characterPlacements).toHaveLength(49);
    characterPlacements.forEach((placement) => expect(placement.framing).toBe('full'));
    expect(speakerLines).toHaveLength(147);
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
