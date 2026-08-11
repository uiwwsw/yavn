import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
);

describe('launcher responsive containment', () => {
  it('clips carousel paint within each slide without a negative media layer', () => {
    expect(styles).toMatch(
      /\.launcher-feature\s*\{[\s\S]*?min-width: 100%;[\s\S]*?max-width: 100%;[\s\S]*?overflow: clip;[\s\S]*?contain: layout paint;/,
    );
    expect(styles).toMatch(
      /\.launcher-feature-media\s*\{[\s\S]*?z-index: 0;[\s\S]*?overflow: clip;/,
    );
    expect(styles).not.toMatch(
      /\.launcher-feature-media\s*\{[\s\S]*?z-index:\s*-\d/,
    );
  });

  it('keeps long tag rows scrollable inside the selected slide width', () => {
    expect(styles).toMatch(
      /\.launcher-feature \.inspector-tag-row\s*\{[\s\S]*?align-self: stretch;[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;[\s\S]*?overflow-y: hidden;/,
    );
    expect(styles).toMatch(
      /\.launcher-feature-copy > \*\s*\{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/,
    );
    expect(styles).toMatch(
      /\.launcher-feature \.inspector-tag-row\s*\{[\s\S]*?scrollbar-width: thin;[\s\S]*?scrollbar-color:/,
    );
    expect(styles).toMatch(
      /\.launcher-tag-filter::-webkit-scrollbar-thumb\s*\{[\s\S]*?background: var\(--launcher-coral\);/,
    );
  });

  it('keeps navigation in a dedicated rail instead of painting over slide copy', () => {
    expect(styles).toMatch(
      /\.launcher-carousel-controls\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: 48px minmax\(0, 1fr\) 48px;[\s\S]*?border-top:/,
    );
    expect(styles).toMatch(
      /\.launcher-carousel-arrow\s*\{[\s\S]*?position: static;/,
    );
    expect(styles).toMatch(
      /\.launcher-carousel-pagination\s*\{[\s\S]*?position: static;/,
    );
  });
});
