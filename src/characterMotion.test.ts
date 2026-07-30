import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
);

describe('image character motion', () => {
  it('keeps horizontal slot offsets out of the transition', () => {
    expect(styles).toContain('transform: translate3d(var(--char-offset-x), 0, 0);');
    expect(styles).toContain('transition: filter 200ms ease-out;');
    expect(styles).toContain('scale: var(--char-scale);');
    expect(styles).toContain('transition: scale 180ms ease-out, filter 200ms ease-out;');
    expect(styles).not.toContain('transition: transform 180ms');
    expect(styles).not.toContain('scale(var(--char-scale))');
  });
});
