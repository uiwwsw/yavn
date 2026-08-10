import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const engineSource = readSource('./engine.ts');
const styles = readSource('./styles.css');

describe('save and game over recovery UI', () => {
  it('separates background autosave recovery from explicit save actions', () => {
    expect(appSource).toContain('<p className="game-over-kicker">GAME OVER</p>');
    expect(appSource).toContain("onClick={() => void onLoadSave('auto')}");
    expect(appSource).toContain("onClick={() => void onLoadSave('manual')}");
    expect(appSource).toContain('onClick={() => void onRestartChapter()}');
    expect(appSource).toContain('onChange={(event) => onToggleAutoSave(event.target.checked)}');
    expect(appSource).toContain('onChange={(event) => void onImportSave(event)}');
    expect(appSource).toContain('<small>선택 직전 복구점</small>');
    expect(appSource).not.toContain("onClick={() => void onLoadSave('latest')}");
    expect(appSource).not.toContain("(['auto', 'manual', 'chapter'] as const)");
  });

  it('opens inventory details directly and keeps discovery controls consistent', () => {
    expect(appSource).toMatch(
      /setSelectedInventoryItemId\(entry\.id\);[\s\S]*?setInventoryDetailOpen\(true\);/,
    );
    expect(appSource).toContain('<div className="inventory-overview"');
    expect(appSource).toContain('<div className="inventory-tools">');
    expect(appSource).not.toContain('inventory-detail-actions');
    expect(styles).toMatch(/@media \(max-width: 400px\)[\s\S]*?\.inventory-grid\s*\{[\s\S]*?repeat\(2,/);
  });

  it('keeps save and game over content inside scrollable responsive bounds', () => {
    expect(styles).toMatch(
      /\.save-system-body\s*\{[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/,
    );
    expect(styles).toMatch(
      /\.game-over-overlay\s*\{[\s\S]*?position: absolute;[\s\S]*?inset: 0;[\s\S]*?overflow: hidden;/,
    );
    expect(styles).toMatch(
      /\.game-over-panel\s*\{[\s\S]*?max-height: 100%;[\s\S]*?overflow-y: auto;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 768px\)[\s\S]*?\.game-over-primary-actions\s*\{[\s\S]*?grid-template-columns: 1fr;/,
    );
  });

  it('isolates ZIP saves and retains the chapter checkpoint as a resume fallback', () => {
    expect(engineSource).toContain('vn-engine-autosave:zip:');
    expect(engineSource).toContain("source: 'chapter'");
    expect(engineSource).toContain("saveProgress(game.script[0].scene, 0, 'chapter')");
  });
});
