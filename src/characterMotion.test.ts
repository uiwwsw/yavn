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
const engineSource = readFileSync(
  fileURLToPath(new URL('./engine.ts', import.meta.url)),
  'utf8',
);
const live2dSource = readFileSync(
  fileURLToPath(new URL('./Live2DCharacter.tsx', import.meta.url)),
  'utf8',
);

describe('image character motion', () => {
  it('glides a mounted character between slots while facing flips snap instantly', () => {
    const charRule = styles.match(/\.char\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(styles).toContain('calc(var(--char-anchor-x) + var(--char-offset-x) + var(--char-framing-x) + var(--char-calibration-x))');
    expect(styles).toContain('var(--char-framing-y)');
    expect(styles).toContain('transform-origin: center bottom;');
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

  it('keeps staged characters mounted while camera membership changes', () => {
    expect(appSource).toContain('const stagedCharactersByPosition = (');
    expect(appSource).toContain('const visibleCharactersByPosition = stagedCharactersByPosition.filter');
    expect(appSource).toContain('visibleCharactersByPosition.map((entry) => ({');
    expect(appSource).not.toContain('const stagedCharacterCount = stagedCharactersByPosition.length');
    expect(appSource).toContain('resolveCharacterFramingScale(slot.framing.scale, visibleCharacterCount)');
    expect(appSource).toContain("const visibilityClass = isCameraVisible ? '' : 'is-camera-hidden';");
    expect(appSource).not.toContain('if (!slot || !visibleCharacterSet.has(slot.id))');
    expect(styles).toMatch(
      /\.char\.is-camera-hidden\s*\{[\s\S]*?visibility: hidden;[\s\S]*?animation: none;[\s\S]*?transition: none;/,
    );
  });

  it('composes mobile slots from the visible cast instead of hidden staged actors', () => {
    expect(appSource).toMatch(
      /const characterStageLayout = resolveCharacterStageLayout\(\s*visibleCharactersByPosition\.map/,
    );
    expect(appSource).not.toMatch(
      /const characterStageLayout = resolveCharacterStageLayout\(\s*stagedCharactersByPosition\.map/,
    );
  });

  it('keeps one fixed composition and applies camera zoom without a position pan', () => {
    expect(appSource).toContain('className="char-composition-world"');
    expect(appSource).toContain('className="char-camera-world"');
    expect(appSource).not.toContain('className="char-camera-pan"');
    expect(appSource).toContain('data-camera-shot={cameraPresentation.shot}');
    expect(appSource).toContain('data-camera-requested-shot={camera.shot}');
    expect(styles).toContain('scale(var(--stage-composition-render-scale))');
    expect(styles).toContain('scale(var(--stage-camera-render-zoom))');
    expect(styles).toContain('--stage-composition-render-scale: var(--stage-composition-scale-mobile)');
    expect(styles).toContain('transform-origin: var(--stage-camera-render-origin-x) var(--stage-camera-render-origin-y);');
    expect(styles).not.toContain('--stage-camera-render-pan-x');
    expect(styles).not.toContain('translate3d(var(--stage-camera-render-pan-x)');
    expect(styles).toContain('transform var(--stage-camera-duration) cubic-bezier(0.22, 1, 0.36, 1)');
    expect(styles).not.toContain('transform-origin var(--stage-camera-duration)');
    expect(styles).toMatch(/\.char-composition-world,[\s\S]*?\.char-camera-world,[\s\S]*?\.char-layer,[\s\S]*?transition: none !important;/);
  });

  it('warms the Live2D renderer alongside chapter asset preloading', () => {
    expect(live2dSource).toContain('export async function prepareLive2DRuntime()');
    expect(engineSource).toContain("import('./Live2DCharacter')");
    expect(engineSource).toContain('? warmLive2DRuntime()');
    expect(engineSource).toContain('const LIVE2D_READY_TIMEOUT_MS = 20000;');
  });

  it('uses separate duo and trio compositions on desktop and mobile', () => {
    expect(appSource).toContain('data-character-count={visibleCharacterCount}');
    expect(appSource).toContain('const characterStageSpacing = resolveCharacterStageSpacing(');
    expect(appSource).toContain('visibleCharactersByPosition.map((entry) => entry.slot.calibration.spacing)');
    expect(appSource).toContain('resolveCharacterStagePlacement(');
    expect(appSource).toContain("'--char-desktop-anchor-x': stagePlacement.anchorX");
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-trio \.char-image\s*\{[\s\S]*?--char-image-height: 67cqh;/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-duo \.char-duo-left\s*\{[\s\S]*?--char-anchor-x: 25cqw;/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-trio \.left\s*\{[\s\S]*?--char-anchor-x: 25cqw;/);
    expect(styles).not.toContain("char-layout-trio[data-camera-shot='medium']");
    expect(styles).not.toContain('.char-layout-trio .char.is-speaker.left');
    expect(styles).not.toContain('--char-anchor-x: -10cqw');
    expect(styles).not.toContain('--char-anchor-x: 110cqw');
  });
});
