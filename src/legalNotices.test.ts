import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfigYaml } from './parser';

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('data-driven legal notices', () => {
  it('routes generic notice data through the launcher and all game disclosure surfaces', () => {
    const app = readSource('src/App.tsx');
    const engine = readSource('src/engine.ts');
    const manifest = readSource('scripts/generate-game-list-manifest.mjs');

    expect(app).toContain('legalNotices: normalizeLegalNotices(value.legalNotices)');
    expect(app).toContain('<LegalNoticeList notices={startGate.legalNotices}');
    expect(app).toMatch(/<LegalNoticeList\s+notices=\{entry\.legalNotices\}/);
    expect(app).toContain('<LegalNoticeList notices={gameLegalNotices}');
    expect(app).toContain('제3자 소프트웨어·자산 고지');
    expect(engine).toContain('legalNotices: parsedConfig.legalNotices');
    expect(manifest).toContain('const MANIFEST_SCHEMA_VERSION = 5;');
    expect(manifest).toContain('legalNotices: normalizeLegalNotices(config?.legalNotices)');
    expect(app).not.toContain('detective-conan-noncommercial-fan-demo');
    expect(app).not.toContain('live2d-ren-poster');
  });

  it('ships story notices as game data and excludes former demos', () => {
    const config = parseConfigYaml(
      readSource('public/game-list/overflow/config.yaml'),
      'public/game-list/overflow/config.yaml',
    );

    expect(config.error).toBeUndefined();
    expect(config.data?.data.legalNotices?.map(notice => notice.id)).toEqual(['content-warning', 'fiction']);
    for (const game of ['conan', 'conan-demo', 'english-conan', 'live2dtest']) {
      expect(existsSync(resolve(process.cwd(), 'public/game-list', game)), game).toBe(false);
    }
    expect(readSource('public/game-list/index.json')).not.toMatch(/conan|코난|live2dtest/i);
  });

  it('keeps authoritative third-party terms and the fan-demo withdrawal in the distribution notice', () => {
    const notices = readSource('THIRD_PARTY_NOTICES.md');

    expect(notices).toContain('Live2D Proprietary Software License Agreement');
    expect(notices).toContain('Live2D Open Software License Agreement');
    expect(notices).toContain('확장 가능한 애플리케이션');
    expect(notices).toContain('공개 배포와 저장소 최신본에서 제외');
    expect(notices).toContain('SIL Open Font License 1.1');
  });
});
