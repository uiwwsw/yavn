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
    expect(styles).toContain('translate 380ms cubic-bezier(0.2, 0.72, 0.24, 1)');
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
    const hiddenRule = styles.match(/\.char\.is-camera-hidden\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(appSource).toContain('const stagedCharactersByPosition = (');
    expect(appSource).toContain('const visibleCharactersByPosition = stagedCharactersByPosition.filter');
    expect(appSource).toContain('const layoutCharactersByPosition = stagedCharactersByPosition.filter');
    expect(appSource).toContain('layoutCharactersByPosition.map((entry) => ({');
    expect(appSource).not.toContain('const stagedCharacterCount = stagedCharactersByPosition.length');
    expect(appSource).toContain('const framingScale = slot.framing.scale;');
    expect(appSource).not.toContain('resolveCharacterFramingScale');
    expect(appSource).toContain("const visibilityClass = isCameraVisible ? '' : 'is-camera-hidden';");
    expect(appSource).not.toContain('if (!slot || !visibleCharacterSet.has(slot.id))');
    expect(styles).toMatch(
      /\.char\.is-camera-hidden\s*\{[\s\S]*?--character-opacity-duration: var\(--character-leave-duration\);[\s\S]*?--character-visibility-delay: var\(--character-leave-duration\);[\s\S]*?opacity: 0 !important;[\s\S]*?visibility: hidden;/,
    );
    expect(hiddenRule).not.toMatch(/(?:animation|transition): none;/);
    expect(styles).toMatch(/\.char\.is-camera-hidden\.is-awaiting-entry\s*\{[\s\S]*?animation: none;/);
    expect(appSource).toContain("const pendingEntryClass = !isCameraVisible && !hasVisiblePlacement ? 'is-awaiting-entry' : '';");
    expect(appSource).toContain('characterPlacementByIdRef.current.get(slot.id) ?? currentPlacement');
    expect(appSource).toContain('characterPlacementByIdRef.current.set(slot.id, currentPlacement)');
  });

  it('coalesces skipped visibility changes on the next paint and releases a group layout after the exit fade', () => {
    expect(appSource).toContain('left.every((id) => right.includes(id))');
    expect(appSource).toContain('characterVisibilityFrameRef.current = window.requestAnimationFrame(() => {');
    expect(appSource).toContain('setPresentedVisibleCharacterIds(nextVisibleCharacterIds);');
    expect(appSource).not.toContain('CHARACTER_VISIBILITY_SETTLE_MS');
    expect(appSource).toContain('const shouldWaitForExit = isCharacterOnlyExit(');
    expect(appSource).toContain('}, CHARACTER_EXIT_FADE_DURATION_MS);');
    expect(appSource).toMatch(
      /const characterStageLayout = resolveCharacterStageLayout\(\s*layoutCharactersByPosition\.map/,
    );
    expect(appSource).not.toMatch(
      /const characterStageLayout = resolveCharacterStageLayout\(\s*stagedCharactersByPosition\.map/,
    );
  });

  it('animates one absolute camera scale and an explicit target pan', () => {
    expect(appSource).toContain('className="char-composition-world"');
    expect(appSource).toContain('className="char-camera-world"');
    expect(appSource).not.toContain('className="char-camera-pan"');
    expect(appSource).toContain('data-camera-shot={cameraPresentation.shot}');
    expect(appSource).toContain('data-camera-requested-shot={camera.shot}');
    expect(styles).toContain('scale(var(--stage-camera-render-scale))');
    expect(styles).toContain('translate3d(var(--stage-camera-render-pan-x), 0, 0)');
    expect(styles).toContain('--stage-camera-render-scale: var(--stage-camera-scale-mobile)');
    expect(styles).toContain('--stage-camera-render-pan-x: var(--stage-camera-pan-x-mobile)');
    expect(styles).toContain('transform-origin: 50cqw var(--stage-camera-render-origin-y);');
    expect(styles).toContain('transform var(--stage-camera-motion-duration) cubic-bezier(0.2, 0.72, 0.24, 1)');
    expect(styles).toContain('var(--stage-camera-motion-delay)');
    expect(styles).not.toContain('transform-origin var(--stage-camera-duration)');
    expect(styles).toMatch(/\.char-composition-world,[\s\S]*?\.char-camera-world,[\s\S]*?\.char-layer,[\s\S]*?transition: none !important;/);
  });

  it('fades a close listener while the camera move overlaps smoothly', () => {
    expect(appSource).toContain('resolveStageCameraTransitionTiming(');
    expect(appSource).toContain("'--stage-camera-motion-duration': `${cameraTransitionTiming.cameraDuration}ms`");
    expect(appSource).toContain("'--stage-camera-motion-delay': `${cameraTransitionTiming.cameraDelay}ms`");
    expect(styles).toContain('opacity var(--character-opacity-duration) cubic-bezier(0.2, 0.65, 0.3, 1)');
    expect(styles).toContain('visibility 0s linear var(--character-visibility-delay)');
    expect(styles).toMatch(
      /\.char-layer\[data-camera-shot='close'\] \.char\.is-listener:not\(\.is-camera-hidden\)\s*\{[\s\S]*?--character-opacity-duration: var\(--character-exit-duration\);[\s\S]*?--character-visibility-delay: var\(--character-exit-duration\);[\s\S]*?opacity: 0;[\s\S]*?visibility: hidden;/,
    );
    expect(styles).toMatch(/@keyframes characterEnter\s*\{[\s\S]*?from\s*\{[\s\S]*?opacity: 0;[\s\S]*?to\s*\{[\s\S]*?opacity: var\(--char-focus-opacity\);/);
    const characterEnter = styles.match(/@keyframes characterEnter\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(characterEnter).not.toContain('translate');
    expect(characterEnter).not.toContain('scale');
  });

  it('warms the Live2D renderer alongside chapter asset preloading', () => {
    expect(live2dSource).toContain('export async function prepareLive2DRuntime()');
    expect(engineSource).toContain("import('./Live2DCharacter')");
    expect(engineSource).toContain('? warmLive2DRuntime()');
    expect(engineSource).toContain('const LIVE2D_READY_TIMEOUT_MS = 20000;');
  });

  it('uses one image ratio with separate duo and trio horizontal anchors', () => {
    expect(appSource).toContain('data-character-count={visibleCharacterCount}');
    expect(appSource).toContain('const characterStageSpacing = resolveCharacterStageSpacing(');
    expect(appSource).toContain('layoutCharactersByPosition.map((entry) => entry.slot.calibration.spacing)');
    expect(appSource).toContain('resolveCharacterStagePlacement(');
    expect(appSource).toContain("'--char-desktop-anchor-x': placement.anchorX");
    expect(appSource).toContain("'--char-mobile-anchor-x': placement.mobileAnchorX");
    expect(styles).toMatch(/\.char-layer \.char\.is-camera-hidden\s*\{[\s\S]*?--char-anchor-x: var\(--char-mobile-anchor-x/);
    expect(styles).toMatch(/\.char-image\s*\{[\s\S]*?--char-image-height: 52cqh;/);
    expect(styles).not.toMatch(/\.char-layer\.char-layout-(?:duo|trio) \.char-image/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-duo \.char-duo-left\s*\{[\s\S]*?--char-anchor-x: 25cqw;/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-trio \.left\s*\{[\s\S]*?--char-anchor-x: 25cqw;/);
    expect(styles).not.toContain("char-layout-trio[data-camera-shot='medium']");
    expect(styles).not.toContain('.char-layout-trio .char.is-speaker.left');
    expect(styles).not.toContain('--char-anchor-x: -10cqw');
    expect(styles).not.toContain('--char-anchor-x: 110cqw');
  });
});
