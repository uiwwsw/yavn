import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const styles = readSource('./styles.css');

describe('choice dialog containment', () => {
  it('reclaims dialogue reserve while choices are visible and keeps overflow scrollable', () => {
    expect(appSource).toContain(
      "${choiceGate.active ? ' has-choice-gate' : ''}",
    );
    expect(styles).toMatch(
      /\.dialog-content-scroll\s*\{[\s\S]*?min-height: 0;[\s\S]*?overflow: auto;/,
    );
    expect(styles).toMatch(
      /\.dialog-box\.has-choice-gate \.text\s*\{[\s\S]*?min-height: 0;/,
    );
    expect(styles).toMatch(
      /\.dialog-box\.has-choice-gate\s*\{[\s\S]*?--dialog-max-height: 46cqh;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 768px\)[\s\S]*?\.dialog-box\.has-choice-gate\s*\{[\s\S]*?--dialog-max-height: 48cqh;/,
    );
    expect(styles).toMatch(
      /\.dialog-box\.has-choice-gate \.choice-gate-options\s*\{[\s\S]*?padding-bottom: 2px;/,
    );
  });

  it('uses a compact count-aware grid for one to four choices', () => {
    expect(appSource).toContain('data-choice-count={choiceGate.options.length}');
    expect(styles).toMatch(
      /\.choice-gate-options\[data-choice-count='2'\],[\s\S]*?\.choice-gate-options\[data-choice-count='3'\],[\s\S]*?\.choice-gate-options\[data-choice-count='4'\]\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(styles).toMatch(
      /\.choice-gate-options\[data-choice-count='3'\] > \.choice-gate-option:last-child\s*\{[\s\S]*?grid-column: 1 \/ -1;/,
    );
    expect(styles).not.toMatch(
      /\.choice-gate-options\[data-choice-count='1'\][\s\S]*?grid-template-columns: repeat\(2/,
    );
  });
});
