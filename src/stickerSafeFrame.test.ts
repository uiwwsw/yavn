import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const styles = readSource('./styles.css');

describe('sticker and mobile dialogue safe areas', () => {
  it('renders every sticker inside the shared stage safe frame', () => {
    expect(appSource).toContain('<div className="sticker-safe-frame">');
    expect(styles).toMatch(
      /\.sticker-safe-frame\s*\{[\s\S]*?top: var\(--stage-safe-block-start\);[\s\S]*?right: var\(--stage-safe-inline-end\);[\s\S]*?bottom: var\(--stage-safe-block-end\);[\s\S]*?left: var\(--stage-safe-inline-start\);/,
    );
    expect(styles).toMatch(
      /\.sticker-safe-frame\s*\{[\s\S]*?container-type: size;/,
    );
    expect(styles).toMatch(
      /\.sticker\s*\{[\s\S]*?max-inline-size: 100%;[\s\S]*?max-width: 100cqw;/,
    );
    expect(styles).toMatch(
      /\.sticker-visual\s*\{[\s\S]*?max-inline-size: 100%;[\s\S]*?max-width: 100cqw;[\s\S]*?object-fit: contain;/,
    );
  });

  it('keeps the mobile dialogue outside viewport and device edges', () => {
    expect(styles).toContain(
      'left: max(10px, env(safe-area-inset-left, 0px));',
    );
    expect(styles).toContain(
      'right: max(10px, env(safe-area-inset-right, 0px));',
    );
    expect(styles).toContain(
      'bottom: max(10px, env(safe-area-inset-bottom, 0px));',
    );
  });
});
