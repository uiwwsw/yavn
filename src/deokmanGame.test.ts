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

    expect(config.data?.data.version).toBe('8.0.0');
    expect(config.data?.data.startScreen?.image).toBe(
      'root:/game-list/deokman/assets/bg/title-deokman-v8-fire-v1.webp',
    );
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

  it('ships a drama-sized choice and consequence graph without duplicate save keys', () => {
    const documents = chapterPaths.map(readYaml);
    const choices = documents.flatMap((document) => collectKey(document, 'choice').map(asRecord));
    const choiceKeys = choices.map((choice) => String(choice.key));
    const gameOvers = documents.flatMap((document) => collectKey(document, 'gameOver').map(asRecord));

    expect(choices).toHaveLength(36);
    expect(new Set(choiceKeys).size).toBe(choiceKeys.length);
    expect(choiceKeys[0]).toBe('c1_peony_observation');
    expect(choiceKeys.at(-1)).toBe('c12_final_decree');
    expect(gameOvers).toHaveLength(11);

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

  it('keeps all player-facing prose inside dialogue, narration, and record channels', () => {
    const documents = chapterPaths.map(readYaml);
    const says = documents.flatMap((document) => collectKey(document, 'say').map(asRecord));
    const channels = new Set(says.map((say) => say.channel ?? (say.char ? 'dialogue' : 'narration')));
    const effects = new Set(documents.flatMap((document) => collectKey(document, 'effect').map((effect) =>
      typeof effect === 'string' ? effect : String(asRecord(effect).name),
    )));

    expect(channels).toEqual(new Set(['dialogue', 'narration', 'record']));
    expect(says.some((say) => say.channel === 'system')).toBe(false);
    expect(effects).toEqual(new Set(['embers', 'darken', 'eclipse']));
    expect(collectStrings(documents).join('\n')).toContain('별은 왕을 선택하지 않는다');
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

          for (const source of [asRecord(action.say), asRecord(action.choice)]) {
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
      'deokman-child-silla-v7.webp',
      'deokman-child-scared-silla-v7.webp',
      'deokman-child-resolve-silla-v7.webp',
    ].map((filename) => readExtendedWebpCanvas(`${gameRoot}assets/char/${filename}`));

    expect(new Set(childSprites.map(({ width, height }) => `${width}x${height}`))).toEqual(new Set(['888x1771']));
    childSprites.forEach(({ hasAlpha }) => expect(hasAlpha).toBe(true));

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
    expect(bible).toContain('## 완결판 구현 현황');
    expect(bible).toContain('/game-list/deokman/');
  });
});
