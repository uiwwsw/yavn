import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const engineSource = readSource('./engine.ts');
const styles = readSource('./styles.css');

describe('save and game over recovery UI', () => {
  it('exposes three persistent save slots and all game over recovery paths', () => {
    expect(appSource).toContain("(['auto', 'manual', 'chapter'] as const)");
    expect(appSource).toContain("onClick={() => void onLoadSave('latest')}");
    expect(appSource).toContain('onClick={() => void onRestartChapter()}');
    expect(appSource).toContain('onChange={(event) => onToggleAutoSave(event.target.checked)}');
    expect(appSource).toContain('onChange={(event) => void onImportSave(event)}');
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
