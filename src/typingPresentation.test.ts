import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

describe('typing presentation', () => {
  it('uses theme-aware emotional glyph colors instead of a global blue deduction glow', () => {
    expect(styles).toContain('text-shadow: var(--ui-deduction-text-shadow);');
    expect(styles).toContain('color: var(--ui-typing-angry-color);');
    expect(styles).toContain('color: var(--ui-typing-shout-color);');
    expect(styles).toContain('color: var(--ui-typing-deduction-color);');
    expect(styles).toContain('var(--ui-typing-sad-shadow-color)');
    expect(styles).toContain('--ui-deduction-text-shadow: none;');
    expect(styles).toContain('--ui-typing-angry-color: #8a2f1d;');
    expect(styles).toContain('--ui-typing-shout-color: #6d2c16;');
    expect(styles).toContain('--ui-typing-deduction-color: #704518;');
    expect(styles).toContain('--ui-typing-deduction-shadow-color: rgba(154, 102, 40, 0.32);');
    expect(styles).not.toContain(
      '.text.delivery-deduction {\n  text-shadow: 0 0 12px rgba(116, 211, 255, 0.12);',
    );
  });
});
