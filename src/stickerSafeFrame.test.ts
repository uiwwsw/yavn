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
      /\.sticker-safe-frame\s*\{[\s\S]*?top: var\(--stage-safe-block-start\);[\s\S]*?right: var\(--stage-safe-inline-end\);[\s\S]*?bottom: calc\(var\(--stage-safe-block-end\) \+ var\(--sticker-dialog-inset\)\);[\s\S]*?left: var\(--stage-safe-inline-start\);/,
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

  it('places stickers around visible characters before revealing them', () => {
    expect(appSource).toContain('fitStickerWithinFrameAvoidingRects(');
    expect(appSource).toContain("querySelectorAll<HTMLElement>('.char-layer .char')");
    expect(appSource).toContain("data-layout-ready={safeFit ? 'true' : 'false'}");
    expect(appSource).toContain('layoutLockedRef.current = true;');
    expect(appSource).toContain('shouldRelayoutStickerForStageResize(');
    expect(appSource).toContain("left: safeFit ? `${safeFit.left}px` : sticker.x");
    expect(appSource).toContain("top: safeFit ? `${safeFit.top}px` : sticker.y");
    expect(appSource).toContain("transition: 'none'");
    expect(appSource).not.toContain('fitAnimationReady');
    expect(appSource).not.toContain('const checkpoints');
    expect(styles).toMatch(
      /\.sticker\[data-layout-ready='false'\]\s*\{[\s\S]*?visibility: hidden;/,
    );
    expect(styles).toMatch(
      /\.sticker\[data-layout-ready='false'\] \.sticker-visual\s*\{[\s\S]*?animation-play-state: paused;/,
    );
  });

  it('keeps the mobile dialogue inside the play frame and device safe areas', () => {
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
