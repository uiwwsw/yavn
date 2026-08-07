import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

describe('screen effect overflow containment', () => {
  it('animates a clipped inner viewport instead of the document-sized app shell', () => {
    expect(appSource).toMatch(/className="app"/);
    expect(appSource).toMatch(/className=\{`effect-viewport \$\{effectClass\}`\}/);
    expect(appSource).not.toMatch(/className=\{`app \$\{effectClass\}`\}/);

    expect(styles).toMatch(
      /\.app\s*\{[\s\S]*?overflow: hidden;[\s\S]*?overflow: clip;[\s\S]*?isolation: isolate;/,
    );
    expect(styles).toMatch(
      /\.effect-viewport\s*\{[\s\S]*?position: absolute;[\s\S]*?inset: 0;[\s\S]*?overflow: hidden;[\s\S]*?overflow: clip;[\s\S]*?contain: paint;/,
    );
  });

  it('keeps transform-heavy effects attached to the contained effect viewport class', () => {
    ['shake', 'zoom', 'tilt', 'impact'].forEach((effect) => {
      expect(styles).toMatch(new RegExp(`\\.effect-${effect}\\s*\\{[\\s\\S]*?animation:`));
    });
  });
});
