import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveTabDestination } from './gameInterface';

describe('game menu keyboard navigation', () => {
  it('wraps both horizontal and vertical menu navigation', () => {
    expect(resolveTabDestination('ArrowRight', 2, 3)).toBe(0);
    expect(resolveTabDestination('ArrowDown', 2, 3)).toBe(0);
    expect(resolveTabDestination('ArrowLeft', 0, 3)).toBe(2);
    expect(resolveTabDestination('ArrowUp', 0, 3)).toBe(2);
  });
  it('supports Home and End without stealing other keys', () => {
    expect(resolveTabDestination('Home', 1, 3)).toBe(0);
    expect(resolveTabDestination('End', 1, 3)).toBe(2);
    expect(resolveTabDestination('Tab', 1, 3)).toBeUndefined();
    expect(resolveTabDestination('Escape', 1, 3)).toBeUndefined();
  });
  it('handles an empty or single-tab menu', () => {
    expect(resolveTabDestination('ArrowRight', 0, 0)).toBeUndefined();
    expect(resolveTabDestination('ArrowLeft', 0, 1)).toBe(0);
  });
});

const readSource = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('in-game UI themes and surfaces', () => {
  const interfaceStyles = readSource('./gameInterface.css');
  const mapStyles = readSource('./storyMap.css');
  const appSource = readSource('./App.tsx');
  const atlasSource = readSource('./StoryAtlas.tsx');

  it('dresses the menu and the story map from the same per-template tokens', () => {
    for (const template of ['neon-grid', 'paper-stage']) {
      expect(interfaceStyles).toContain(`:is(.app, .story-atlas)[data-ui-template='${template}'] {`);
    }
    expect(atlasSource).toContain('data-ui-template={uiTemplate}');
    expect(appSource).toMatch(/<StoryMap\s+uiTemplate=\{uiTemplate\}/);
    // The map keeps no palette of its own.
    expect(mapStyles).not.toMatch(/#[0-9a-f]{6}\b(?![0-9a-f])/i);
    expect(atlasSource).not.toMatch(/fill="#/);
  });

  it('keeps HUD tools consistent, named and at least 44px on phones', () => {
    expect(appSource).toContain('<GameIcon name="map" />');
    expect(appSource).not.toContain('<span aria-hidden="true">◇</span>');
    expect(interfaceStyles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.app \.hud-action-button \{ width: 44px; height: 44px; min-width: 44px;/);
    expect(appSource).toContain('aria-label={t("저장과 설정 열기")}');
  });

  it('marks items the player has not opened yet and remembers opened ones', () => {
    expect(appSource).toContain("const INVENTORY_INSPECTED_STORAGE_PREFIX = 'vn-inventory-inspected:';");
    expect(appSource).toContain('<span className="inventory-slot-new" aria-hidden="true">{t("새로 얻음")}</span>');
    expect(interfaceStyles).toMatch(/\.app \.inventory-slot-new \{[^}]*transform: rotate\(var\(--game-new-rotate\)\)/);
  });

  it('groups play settings into real controls with visible focus', () => {
    for (const group of ['텍스트 속도', '자동 진행', '소리', '화면과 움직임', '접근성']) {
      expect(appSource).toContain(`<legend>{t("${group}")}</legend>`);
    }
    expect(appSource).toContain('name="player-text-scale"');
    expect(interfaceStyles).toMatch(/\.player-segment:has\(input:focus-visible\) \{[^}]*outline: 2px solid/);
    expect(interfaceStyles).toMatch(/\.app\[data-text-scale='large'\] \{ --game-text-scale: 1\.125; \}/);
  });

  it('keeps log speakers, record lines and message bubbles visually distinct', () => {
    expect(appSource).toContain('data-channel={channel}');
    expect(interfaceStyles).toMatch(/\.story-log-entry:is\(\[data-channel='record'\], \[data-channel='system'\]\) > p \{[^}]*border: 1px solid/);
    expect(interfaceStyles).toMatch(/\.story-log-entry\[data-channel='message'\] > p \{[^}]*border-radius: 16px 16px 16px 4px/);
  });

  it('turns off menu motion for reduced-motion players', () => {
    expect(interfaceStyles).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.app :is\(\.settings-modal,[^}]*animation: none;/);
  });
});
