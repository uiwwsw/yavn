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

  it('places stickers before revealing them and hides stale fits during collision-driven relocations', () => {
    expect(appSource).toContain('fitStickerWithinFrameAvoidingRects(');
    expect(appSource).toContain('doesStickerOverlapRects(');
    expect(appSource).toContain('haveStickerObstacleRectsSettled(');
    expect(appSource).toContain("querySelectorAll<HTMLElement>('.char-layer .char')");
    expect(appSource).toContain('STICKER_CHARACTER_LAYOUT_SETTLE_MS');
    expect(appSource).toContain('STICKER_OBSTACLE_SAMPLE_MS');
    expect(appSource).toContain('resolvedAvoidanceKey === avoidanceKey');
    expect(appSource).toContain("data-layout-ready={layoutReady ? 'true' : 'false'}");
    expect(appSource).toContain("data-layout-reflow={layoutReady && layoutReflowing ? 'true' : 'false'}");
    expect(appSource).toContain("setResolvedAvoidanceKey('');");
    expect(appSource).toContain('layoutLockedRef.current = true;');
    expect(appSource).toContain('shouldRelayoutStickerForStageResize(');
    expect(appSource).toContain('scheduleSafeFit(STICKER_LAYOUT_QUIET_MS, true);');
    expect(appSource).toContain("left: safeFit ? `${safeFit.left}px` : sticker.x");
    expect(appSource).toContain("top: safeFit ? `${safeFit.top}px` : sticker.y");
    expect(appSource).toContain("data-layout-motion={layoutReady && layoutMotionReady ? 'true' : 'false'}");
    expect(appSource).toContain('setLayoutMotionReady(true);');
    expect(appSource).toContain('layoutMotionFrameRef.current = window.requestAnimationFrame(() => {');
    expect(appSource).not.toContain('fitAnimationReady');
    expect(appSource).not.toContain('const checkpoints');
    expect(styles).toMatch(
      /\.sticker\[data-layout-motion='true'\]\s*\{[\s\S]*?left 280ms[\s\S]*?top 280ms[\s\S]*?transform 280ms/,
    );
    expect(styles).toMatch(
      /\.sticker\[data-layout-ready='false'\]\s*\{[\s\S]*?visibility: hidden;/,
    );
    expect(styles).toMatch(
      /\.sticker\[data-layout-ready='false'\] \.sticker-visual\s*\{[\s\S]*?animation-play-state: paused;/,
    );
    expect(styles).toMatch(
      /\.sticker\[data-layout-ready='true'\]\[data-layout-reflow='true'\]\s*\{[\s\S]*?stickerSafeReflowReveal 160ms/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.sticker,[\s\S]*?transition: none !important;/,
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
