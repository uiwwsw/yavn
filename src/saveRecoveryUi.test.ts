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
    expect(appSource).toContain("choiceRecoveryPoint.exists ? onLoadLastChoice() : onLoadSave('auto')");
    expect(appSource).toContain("onClick={() => void onLoadSave('manual')}");
    expect(appSource).toContain('onClick={() => void onRestartChapter()}');
    expect(appSource).toContain('onChange={(event) => onToggleAutoSave(event.target.checked)}');
    expect(appSource).toContain('onChange={(event) => void onImportSave(event)}');
    expect(appSource).toContain('<small>선택 직전 복구점</small>');
    expect(appSource).not.toContain("onClick={() => void onLoadSave('latest')}");
    expect(appSource).not.toContain("(['auto', 'manual', 'chapter'] as const)");
    expect(engineSource).toContain("const CHOICE_RECOVERY_SUFFIX = ':choice-recovery'");
    expect(engineSource).toContain("const CHOICE_RECOVERY_TRAIL_SUFFIX = ':choice-recovery-trail'");
    expect(engineSource).toContain('recordChoiceRecoveryPoint({');
    expect(appSource).toContain("'마지막 선택으로'");
    expect(appSource).toContain('{totalEndingCount > 0 && (');
  });

  it('marks the previous game-over choice without disabling it and focuses an alternative', () => {
    expect(engineSource).toContain('choiceAttempt: {');
    expect(engineSource).toContain('ledToGameOver: true');
    expect(engineSource).toContain('failedChoice: recovery.choiceAttempt?.ledToGameOver');
    expect(appSource).toContain('setRecoveredFailedChoice(recoveryPoint.failedChoice)');
    expect(appSource).toContain("' choice-gate-option-previous-game-over'");
    expect(appSource).toContain('<b>원인 선택</b>');
    expect(appSource).toContain('죽음의 원인 선택으로');
    expect(appSource).toContain('<div className="game-over-cause" aria-label="결과를 만든 선택">');
    expect(appSource).toContain('{choiceRecoveryPoint.failedChoice.value}');
    expect(appSource).toContain('<em>GAME OVER</em>');
    expect(appSource).toContain('choiceOptionButtonRefs.current[focusIndex]?.focus');
    expect(appSource).toContain('index !== recoveredFailedChoiceIndex');
    expect(styles).toMatch(
      /\.choice-gate-option-previous-game-over\s*\{[\s\S]*?background:[\s\S]*?filter: saturate/,
    );
    expect(styles).toMatch(
      /\.choice-gate-option-previous-game-over:focus-visible\s*\{[\s\S]*?box-shadow:/,
    );
    expect(styles).toMatch(
      /\.game-over-cause\s*\{[\s\S]*?border:[\s\S]*?background:[\s\S]*?text-align: left;/,
    );
    expect(appSource).not.toContain('disabled={busy || isPreviousGameOverChoice}');
  });

  it('opens inventory details directly and keeps discovery controls consistent', () => {
    expect(appSource).toMatch(
      /setSelectedInventoryItemId\(entry\.id\);[\s\S]*?setInventoryDetailOpen\(true\);/,
    );
    expect(appSource).toContain('<div className="inventory-overview"');
    expect(appSource).toContain('<div className="inventory-tools">');
    expect(appSource).toContain('도감 살펴보기');
    expect(appSource).toContain('검색 조건 초기화');
    expect(appSource).toContain('disabled={!entry.owned}');
    expect(appSource).toContain("entry.owned ? entry.name : '미발견 단서'");
    expect(appSource).not.toContain('inventory-detail-actions');
    expect(appSource).toContain('className="inventory-collection-header"');
    expect(appSource).toContain('className="inventory-slot-index"');
    expect(styles).toMatch(/@media \(max-width: 340px\)[\s\S]*?\.inventory-grid\s*\{[\s\S]*?repeat\(2,/);
    expect(styles).toMatch(
      /\.inventory-search-field input::placeholder\s*\{[\s\S]*?color: var\(--ui-input-placeholder\);/,
    );
    expect(styles).toMatch(
      /\.settings-inventory-body\.has-tools\s*\{[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\);/,
    );
  });

  it('keeps save controls visible while only the archive cards scroll', () => {
    expect(styles).toMatch(
      /\.save-system-body\s*\{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto auto;[\s\S]*?overflow: hidden;/,
    );
    expect(styles).toMatch(
      /\.save-system-grid\s*\{[\s\S]*?min-height: 0;[\s\S]*?grid-auto-rows: max-content;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/,
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
    expect(styles).toMatch(
      /\.dialog-content-scroll,[\s\S]*?\.ending-credits-roll\s*\{[\s\S]*?scrollbar-width: thin;[\s\S]*?scrollbar-color:/,
    );
    expect(appSource).not.toContain("'YAVN ENGINE'");
    expect(appSource).toContain('<h2>기록 보관소</h2>');
    expect(appSource).toContain("'게임 시작 화면으로 가기'");
    expect(appSource).toContain('save-protection-hero');
    expect(appSource).toContain('className="save-system-grid"');
    expect(styles).toMatch(/\.save-system-grid\s*\{[\s\S]*?grid-template-columns: repeat\(3,/);
    expect(styles).toMatch(
      /@media \(max-width: 768px\)[\s\S]*?\.save-system-grid\s*\{[\s\S]*?grid-template-columns: 1fr;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 768px\) and \(orientation: portrait\)[\s\S]*?\.settings-modal\s*\{[\s\S]*?height: 100cqh;[\s\S]*?\.save-system-body\s*\{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto auto;[\s\S]*?overflow: hidden;/,
    );
    expect(appSource).toContain("className={`stage-content-frame${settingsOpen ? ' has-settings-modal' : ''}`}");
    expect(styles).toMatch(
      /@media \(max-width: 768px\) and \(orientation: portrait\)[\s\S]*?\.stage-content-frame\.has-settings-modal\s*\{[\s\S]*?height: 100%;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 768px\) and \(orientation: portrait\)[\s\S]*?\.save-system-grid\s*\{[\s\S]*?grid-auto-rows: max-content;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/,
    );
    expect(appSource).toContain("choiceGate.active ? '선택 대기' : '다음'");
  });

  it('isolates ZIP saves and retains the chapter checkpoint as a resume fallback', () => {
    expect(engineSource).toContain('vn-engine-autosave:zip:');
    expect(engineSource).toContain("source: 'chapter'");
    expect(engineSource).toContain("saveProgress(game.script[0].scene, 0, 'chapter')");
    expect(engineSource).toContain("import type JSZip from 'jszip'");
    expect(engineSource).toContain("await import('jszip')");
    expect(engineSource).not.toContain("import JSZip from 'jszip'");
  });
});
