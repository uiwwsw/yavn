import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
);
const appSource = readFileSync(
  fileURLToPath(new URL('./App.tsx', import.meta.url)),
  'utf8',
);

describe('image character motion', () => {
  it('glides a mounted character between slots while facing flips snap instantly', () => {
    const charRule = styles.match(/\.char\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(styles).toContain('calc(var(--char-anchor-x) + var(--char-offset-x) + var(--char-framing-x) + var(--char-calibration-x))');
    expect(styles).toContain('var(--char-framing-y)');
    expect(styles).toContain('transform-origin: center top;');
    expect(styles).toContain('--char-facing-scale-x: 1;');
    expect(styles).toContain('transform: scaleX(var(--char-facing-scale-x));');
    expect(styles).toContain('scale: var(--char-scale);');
    expect(styles).toContain('translate 320ms cubic-bezier(0.22, 1, 0.36, 1)');
    expect(charRule).not.toContain('left 360ms');
    expect(charRule).not.toContain('width 320ms');
    expect(charRule).not.toContain('filter 200ms');
    expect(charRule).not.toContain('will-change: left');
    expect(charRule).not.toMatch(/transition:[^;]*transform/);
    expect(styles).not.toContain('scale(var(--char-scale))');
    expect(appSource).toContain('key={buildImageCharacterRenderKey(slot.id)}');
    expect(appSource).toContain('key={`character-${slot.id}`}');
    expect(appSource).toContain('trackingKey={buildLive2DLoadKey(slot)}');
    expect(appSource).toContain('decoding="async"');
  });

  it('moves every visible character through one shared camera world', () => {
    expect(appSource).toContain('className="char-camera-world"');
    expect(appSource).toContain('className="char-camera-pan"');
    expect(appSource).toContain('data-camera-shot={camera.shot}');
    expect(styles).toContain('scale(var(--stage-camera-scale))');
    expect(styles).toContain('transform-origin: 50% var(--stage-camera-render-origin-y);');
    expect(styles).toContain('translate3d(var(--stage-camera-render-pan-x), var(--stage-camera-render-pan-y), 0)');
    expect(styles).toMatch(/@media \(min-width: 769px\)[\s\S]*?\.char-layer:not\(\[data-camera-shot='wide'\]\) \.char-camera-world/);
    expect(styles).toContain('transform var(--stage-camera-duration) cubic-bezier(0.22, 1, 0.36, 1)');
    expect(styles).not.toContain('transform-origin var(--stage-camera-duration)');
    expect(styles).toMatch(/\.char-camera-world,[\s\S]*?\.char-camera-pan,[\s\S]*?\.char-layer,[\s\S]*?transition: none !important;/);
  });

  it('uses separate duo and trio compositions on desktop and mobile', () => {
    expect(appSource).toContain('data-character-count={visibleCharacterCount}');
    expect(appSource).toContain('resolveCharacterStagePlacement(');
    expect(appSource).toContain("'--char-desktop-anchor-x': stagePlacement.anchorX");
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-trio \.char-image\s*\{[\s\S]*?--char-image-width: min\(52cqw, 410px\);/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-duo \.char-duo-left\s*\{[\s\S]*?--char-anchor-x: 25cqw;/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-trio \.left\s*\{[\s\S]*?--char-anchor-x: 15cqw;/);
    expect(styles).not.toContain("char-layout-trio[data-camera-shot='medium']");
    expect(styles).not.toContain('.char-layout-trio .char.is-speaker.left');
  });
});
