import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

type UnknownRecord = Record<string, unknown>;

const gameRoot = fileURLToPath(new URL('../public/game-list/deokman-v8-preview/', import.meta.url));
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const biblePath = fileURLToPath(new URL('../docs/DEOKMAN_V8_GAME_BIBLE.ko.md', import.meta.url));
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

describe('Deokman V8 chapter-one vertical slice', () => {
  it('resolves the preview through the complete YAVN schema', () => {
    const config = parseConfigYaml(readSource('config.yaml'), 'deokman-v8-preview/config.yaml');
    const base = parseBaseYaml(readSource('base.yaml'), 'deokman-v8-preview/base.yaml');
    const chapter = parseChapterYaml(readSource('0.yaml'), 'deokman-v8-preview/0.yaml');

    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    expect(chapter.error).toBeUndefined();
    expect(config.data).toBeDefined();
    expect(base.data).toBeDefined();
    expect(chapter.data).toBeDefined();
    if (!config.data || !base.data || !chapter.data) return;

    expect(resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data }).error)
      .toBeUndefined();
  });

  it('ships three consequential decisions with gated recalls and dramatized outcomes', () => {
    const document = readYaml('0.yaml');
    const choices = collectKey(document, 'choice').map(asRecord);
    const options = choices.flatMap((choice) => Array.isArray(choice.options) ? choice.options.map(asRecord) : []);
    const gameOvers = collectKey(document, 'gameOver').map(asRecord);
    const endings = collectKey(document, 'ending').map(String);

    expect(choices.map((choice) => choice.key)).toEqual([
      'c1_peony_observation',
      'c1_answer_king',
      'c1_fire_escape',
    ]);
    expect(choices.map((choice) => (choice.options as unknown[]).length)).toEqual([5, 4, 5]);
    expect(options.filter((option) => Object.keys(asRecord(option.when)).length > 0)).toHaveLength(3);
    expect(options.some((option) => String(JSON.stringify(option.when)).includes('observed_left_waterway'))).toBe(true);
    expect(options.some((option) => String(JSON.stringify(option.when)).includes('death_register'))).toBe(true);
    expect(gameOvers).toHaveLength(4);
    expect(new Set(gameOvers.map((gameOver) => String(gameOver.title))).size).toBe(4);
    expect(new Set(endings)).toEqual(new Set(['hidden_name', 'marked_survivor', 'ash_witness']));

    const scenes = asRecord(document.scenes);
    Object.entries(scenes).forEach(([sceneId, sceneValue]) => {
      const actions = Array.isArray(asRecord(sceneValue).actions)
        ? (asRecord(sceneValue).actions as unknown[]).map(asRecord)
        : [];
      const gameOverIndex = actions.findIndex((action) => Object.keys(asRecord(action.gameOver)).length > 0);
      if (gameOverIndex < 0) return;
      const leadIn = actions.slice(0, gameOverIndex);
      expect(gameOverIndex, sceneId).toBe(actions.length - 1);
      expect(collectKey(leadIn, 'say').length, sceneId).toBeGreaterThanOrEqual(4);
      expect(leadIn.some((action) => typeof action.bg === 'string'), sceneId).toBe(true);
    });
  });

  it('uses all four prose channels and the new effects as narrative grammar', () => {
    const document = readYaml('0.yaml');
    const says = collectKey(document, 'say').map(asRecord);
    const channels = new Set(says.map((say) => say.channel ?? (say.char ? 'dialogue' : 'narration')));
    const effects = collectKey(document, 'effect').map((effect) =>
      typeof effect === 'string' ? effect : String(asRecord(effect).name),
    );

    expect(channels).toEqual(new Set(['dialogue', 'narration', 'record', 'system']));
    expect(effects).toEqual(expect.arrayContaining(['focus', 'inkstamp', 'impact', 'embers', 'starfall']));
    expect(says.some((say) => say.channel === 'record' && String(say.text).includes('둘째 공주 덕만'))).toBe(true);
    expect(says.some((say) => say.channel === 'system' && String(say.text).includes('[기록 완료]'))).toBe(true);
  });

  it('keeps every speaker visibly staged along every reachable local branch', () => {
    const document = readYaml('0.yaml');
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
        if (typeof action.goto === 'string' && !action.goto.startsWith('/')) {
          visit(action.goto, { ...slots });
          return;
        }
      }
    };

    visit(openingScene, {});
    expect(failures).toEqual([]);
  });

  it('ships aligned transparent child sprites and every referenced root asset', () => {
    const base = readYaml('base.yaml');
    const assetPaths = collectStrings(base).filter((path) => path.startsWith('root:/'));

    assetPaths.forEach((path) => {
      expect(existsSync(`${publicRoot}${path.slice('root:/'.length)}`), path).toBe(true);
    });

    const childSprites = [
      'deokman-child-silla-v5.webp',
      'deokman-child-scared-silla-v5.webp',
      'deokman-child-resolve-silla-v5.webp',
    ].map((filename) => readExtendedWebpCanvas(`${publicRoot}game-list/deokman/assets/char/${filename}`));

    expect(new Set(childSprites.map(({ width, height }) => `${width}x${height}`))).toEqual(new Set(['888x1771']));
    childSprites.forEach(({ hasAlpha }) => expect(hasAlpha).toBe(true));
  });

  it('documents the complete 12-chapter production contract', () => {
    const bible = readFileSync(biblePath, 'utf8');
    expect(bible).toContain('## 12챕터 드라마 지도');
    expect(bible).toContain('| 12 | 마지막 기록 |');
    expect(bible).toContain('## 핵심 인물과 연기 방향');
    expect(bible).toContain('## 대사·내레이션·시스템 채널');
    expect(bible).toContain('## 선택과 엔딩 설계 규칙');
    expect(bible).toContain('## 1장 수직 슬라이스 합격 기준');
  });
});
