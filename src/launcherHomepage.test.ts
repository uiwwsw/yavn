import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');
const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
  dependencies?: Record<string, string>;
};

describe('launcher homepage experience', () => {
  it('keeps ordinary carousel browsing out of the address bar', () => {
    expect(app).not.toContain('buildLauncherDemoHash');
    expect(app).not.toContain("window.addEventListener('hashchange'");
    expect(app).toContain('buildLauncherDemoSharePath(');
    expect(app).toContain('clearLauncherDeepLinkFromAddress();');
    expect(app).not.toContain('LAUNCHER_SELECTION_SESSION_KEY');
    expect(app).not.toContain('storeLauncherGameId(');
    expect(app).toContain('useEmblaCarousel(LAUNCHER_CAROUSEL_OPTIONS)');
    expect(app).toContain("launcherCarouselApi.on('select', commitSelectedSnap)");
    expect(packageJson.dependencies?.['embla-carousel-react']).toBe('8.6.0');
    expect(app).not.toContain('onLauncherCarouselScroll');
    expect(app).not.toContain('onScroll={');
    expect(app).not.toContain('launcherCarouselDragRef');
    expect(app).not.toContain('launcher-loading-track');
    expect(app).toContain('loading="eager"');
    expect(app).toContain('linkTabIndex={isSelected ? undefined : -1}');
    expect(styles).toMatch(/\.launcher-carousel-track\s*\{[^}]*will-change: transform;/);
    expect(styles).not.toContain('@keyframes launcherManifestLoading');
    expect(styles).not.toContain('@keyframes launcherConsoleIn');
    expect(app).toContain('선택 링크 복사');
    expect(app).toContain('buildGameSourceUrl(repositoryUrl, entry.id)');
    expect(app).toContain('/tree/main/public/game-list/${encodeURIComponent(gameId)}');
  });

  it('presents the engine as a creation tool and keeps mobile guide access', () => {
    expect(app).toContain('className="launcher-engine-overview"');
    expect(app).toContain('코드보다 이야기에 집중하세요.');
    expect(app).toContain('제작 가이드 시작');
    expect(app).toContain('샘플 YAML 보기');
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.launcher-nav \.launcher-nav-github\s*\{[\s\S]*?display: none;/);
    expect(styles).not.toMatch(/@media \(max-width: 768px\)[\s\S]*?\.launcher-nav a\s*\{[\s\S]*?display: none;/);
  });

  it('keeps discovery and native browser interaction accessible', () => {
    expect(app).toContain('className="launcher-skip-link"');
    expect(app).toContain('aria-label="YAVN 게임 ZIP 실행"');
    expect(app).toContain('visibleLauncherTags.map');
    expect(app).toContain('검색 조건 초기화');
    expect(app).toContain("target?.closest('.app')");
    expect(styles).toMatch(/\.launcher-upload input\s*\{[^}]*opacity: 0;[^}]*cursor: pointer;/);
    expect(styles).not.toMatch(/\.launcher-upload input\s*\{[^}]*display: none;/);
  });
});
