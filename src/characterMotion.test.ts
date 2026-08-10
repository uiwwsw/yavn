import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
);

describe('image character motion', () => {
  it('keeps slot offsets stable while framing scale transitions between shots', () => {
    expect(styles).toContain('calc(var(--char-offset-x) + var(--char-framing-x))');
    expect(styles).toContain('var(--char-framing-y)');
    expect(styles).toContain('transform-origin: center top;');
    expect(styles).toContain('scale: var(--char-scale);');
    expect(styles).toContain('left: calc(50% - var(--char-image-width) / 2);');
    expect(styles).toContain('transform: translate3d(var(--char-framing-x), var(--char-framing-y), 0);');
    expect(styles).toContain('transition: scale 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease-out;');
    expect(styles).not.toContain('transition: transform 180ms');
    expect(styles).not.toContain('scale(var(--char-scale))');
  });
});
