import { readFileSync } from 'node:fs';
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

  it('ships the exact Live2D attribution and explicit Conan noncommercial status as game data', () => {
    const live2dConfig = parseConfigYaml(
      readSource('public/game-list/live2dtest/config.yaml'),
      'public/game-list/live2dtest/config.yaml',
    );
    const conanConfig = parseConfigYaml(
      readSource('public/game-list/conan/config.yaml'),
      'public/game-list/conan/config.yaml',
    );
    const conanDemoConfig = parseConfigYaml(
      readSource('public/game-list/conan-demo/config.yaml'),
      'public/game-list/conan-demo/config.yaml',
    );

    expect(live2dConfig.error).toBeUndefined();
    expect(live2dConfig.data?.data.legalNotices?.[0]).toMatchObject({
      id: 'live2d-ren-poster',
      copyright: '© Live2D Inc.',
      text:
        '본 작품의 캐릭터에는 주식회사 Live2D가 정하는 약관에 따라 주식회사 Live2D의 저작물인 샘플 데이터가 이용되었습니다. 본 작품은 제작자의 완전한 자기 재량으로 제작되었습니다.',
    });
    for (const parsed of [conanConfig, conanDemoConfig]) {
      expect(parsed.error).toBeUndefined();
      expect(parsed.data?.data.legalNotices?.[0]).toMatchObject({
        id: 'detective-conan-noncommercial-fan-demo',
        title: '비공식·비상업적 팬 데모',
      });
      expect(parsed.data?.data.legalNotices?.[0]?.text).toContain('수익화하지 않으며');
      expect(parsed.data?.data.legalNotices?.[0]?.text).toContain('이용 허락을 대신하지 않습니다');
    }
  });

  it('keeps authoritative third-party terms and the unresolved fan-demo risk in the distribution notice', () => {
    const notices = readSource('THIRD_PARTY_NOTICES.md');

    expect(notices).toContain('Live2D Proprietary Software License Agreement');
    expect(notices).toContain('Live2D Open Software License Agreement');
    expect(notices).toContain('확장 가능한 애플리케이션');
    expect(notices).toContain('이용허락 증빙이 포함되어 있지 않습니다');
    expect(notices).toContain('오리지널 명칭·캐릭터·이미지·음원으로 교체');
    expect(notices).toContain('SIL Open Font License 1.1');
  });
});
