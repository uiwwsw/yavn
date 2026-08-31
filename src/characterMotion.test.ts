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
const stageImageCharacterSource = readFileSync(
  fileURLToPath(new URL('./StageImageCharacter.tsx', import.meta.url)),
  'utf8',
);

describe('image character motion', () => {
  it('glides a mounted character between slots while facing flips snap instantly', () => {
    const charRule = styles.match(/^\.char\s*\{([\s\S]*?)\n\}/m)?.[1] ?? '';
    expect(styles).toContain('calc(var(--char-anchor-x) + var(--char-offset-x) + var(--char-framing-x) + var(--char-calibration-x))');
    expect(styles).toContain('var(--char-framing-y)');
    expect(styles).toContain('transform-origin: 50% 100%;');
    expect(styles).toContain('--char-facing-scale-x: 1;');
    expect(styles).toContain('transform: scaleX(var(--char-facing-scale-x));');
    expect(styles).toContain('scale: var(--char-scale);');
    expect(charRule).toContain('--character-position-duration: 380ms;');
    expect(charRule).toContain('--character-scale-duration: 360ms;');
    expect(styles).toContain('translate var(--character-position-duration) var(--character-position-easing) var(--character-position-delay)');
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

  it('snaps entering and hidden actors to their target slot while fading visibility only', () => {
    const hiddenRule = styles.match(/\.char\.is-camera-hidden\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const enteringRule = styles.match(/\.char\.is-entering\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(appSource).toContain('const stagedCharactersByPosition = useMemo(');
    expect(appSource).toContain('const visibleCharactersByPosition = useMemo(');
    expect(appSource).toContain('() => stagedCharactersByPosition.filter((entry) => visibleCharacterSet.has(entry.slot.id))');
    expect(appSource).toContain('const layoutCharactersByPosition = useMemo(');
    expect(appSource).toContain('() => stagedCharactersByPosition.filter((entry) => layoutCharacterSet.has(entry.slot.id))');
    expect(appSource).toContain('layoutCharactersByPosition.map((entry) => ({');
    expect(appSource).not.toContain('const stagedCharacterCount = stagedCharactersByPosition.length');
    expect(appSource).toContain('const framingScale = slot.framing.scale;');
    expect(appSource).not.toContain('resolveCharacterFramingScale');
    expect(appSource).toContain("const visibilityClass = isCameraVisible ? '' : 'is-camera-hidden';");
    expect(appSource).not.toContain('if (!slot || !visibleCharacterSet.has(slot.id))');
    expect(styles).toMatch(
      /\.char\.is-camera-hidden\s*\{[\s\S]*?--character-opacity-duration: var\(--character-leave-duration\);[\s\S]*?--character-visibility-delay: var\(--character-leave-duration\);[\s\S]*?--character-position-duration: 0ms;[\s\S]*?--character-scale-duration: 0ms;[\s\S]*?opacity: 0 !important;[\s\S]*?visibility: hidden;[\s\S]*?animation: none;/,
    );
    expect(hiddenRule).toContain('animation: none;');
    expect(enteringRule).toContain('--character-position-duration: 0ms;');
    expect(enteringRule).toContain('--character-scale-duration: 0ms;');
    expect(appSource).toContain('const enteringCharacterSet = useMemo(');
    expect(appSource).toContain('const characterEntranceMotionActive = useTransientMotionWindow(');
    expect(appSource).toContain('&& characterEntranceMotionActive');
    expect(appSource).toContain('const entryClass = isEntering ? `is-entering char-enter-${slot.enterEffect}` : \'\';');
    expect(appSource).toContain('data-character-enter-layout={characterEnterLayout}');
    expect(appSource).toMatch(/const stickerAvoidanceSettleMs = Math\.max\([\s\S]*?characterEnterMotionDurationMs,/);
    expect(styles).toContain(".char-layer[data-character-moving='true'][data-character-enter-layout='cut'] .char:not(.is-entering)");
    expect(styles).toContain(".char-layer[data-character-moving='true'][data-character-enter-layout='push'] .char:not(.is-entering):not(.is-camera-hidden)");
    expect(styles).toContain('--character-position-easing: var(--character-enter-layout-easing);');
    expect(styles).toContain('--character-position-delay: var(--character-enter-layout-delay);');
    expect(styles).toContain(".char-layer[data-character-moving='true'][data-character-enter-layout='push'] .char.is-breathing:not(.is-entering):not(.is-camera-hidden)");
    expect(styles).toContain('.char.is-entering:not(.char-enter-none)');
    expect(styles).toContain('var(--character-enter-animation)');
    expect(styles.match(/^\.char\s*\{([\s\S]*?)\n\}/m)?.[1] ?? '').not.toContain('--character-enter-layout-duration: 380ms;');
    expect(styles.match(/\.char-composition-world\s*\{([\s\S]*?)\n\}/)?.[1] ?? '').toContain('--character-enter-layout-duration: 380ms;');
    expect(appSource).not.toContain('characterPlacementByIdRef');
    expect(appSource).not.toContain('is-awaiting-entry');
  });

  it('buffers undecoded image sources without flashing an intermediate request', () => {
    expect(appSource).toContain('<StageImageCharacter');
    expect(appSource).toContain('source={slot.source}');
    expect(stageImageCharacterSource).toContain('const [presentation, setPresentation]');
    expect(stageImageCharacterSource).toContain('if (presentation.source === source)');
    expect(stageImageCharacterSource).toContain('latestSourceRef.current !== source');
    expect(stageImageCharacterSource).toContain('waitForImageReady(preload, CHARACTER_IMAGE_READY_TIMEOUT_MS)');
    expect(stageImageCharacterSource).toContain("!cancelled && status === 'ready'");
    expect(stageImageCharacterSource).toContain("? 'holding'");
    expect(stageImageCharacterSource).toContain("'is-image-pending'");
    expect(styles).toMatch(
      /\.char-image\.is-image-pending\s*\{[\s\S]*?opacity: 0 !important;[\s\S]*?visibility: hidden;[\s\S]*?animation: none !important;/,
    );
  });

  it('coalesces skipped visibility changes and overlaps exit fade with one survivor glide', () => {
    expect(appSource).toContain('left.every((id) => right.includes(id))');
    expect(appSource).toContain('characterVisibilityFrameRef.current = window.requestAnimationFrame(() => {');
    expect(appSource).toMatch(
      /setLayoutVisibleCharacterIds\(nextVisibleCharacterIds\);\s*setPresentedVisibleCharacterIds\(nextVisibleCharacterIds\);/,
    );
    expect(appSource).toContain('const nextLeavingPlacements = new Map(leavingCharacterPlacementRef.current);');
    expect(appSource).toContain('resolveCharacterStageRenderPlacement(');
    expect(appSource).toContain('leavingCharacterPlacementRef.current = nextLeavingPlacements;');
    expect(appSource).toContain(': leavingCharacterPlacementRef.current.get(slot.id) ?? currentPlacement;');
    expect(appSource).not.toContain('shouldHoldPreviousLayout');
    expect(appSource).not.toContain('shouldWaitForExit');
    expect(appSource).not.toContain('characterLayoutReleaseTimerRef');
    expect(appSource).not.toContain('CHARACTER_VISIBILITY_SETTLE_MS');
    expect(appSource).toMatch(
      /const characterStageLayout = useMemo\([\s\S]*?resolveCharacterStageLayout\(\s*layoutCharactersByPosition\.map/,
    );
    expect(appSource).not.toMatch(
      /const characterStageLayout = resolveCharacterStageLayout\(\s*stagedCharactersByPosition\.map/,
    );
  });

  it('accelerates interrupted manual playback without cutting motion entirely', () => {
    expect(appSource).toContain('function useManualAdvanceTempo()');
    expect(appSource).toContain('function useLatchedMotionTempo(');
    expect(appSource).toContain('const characterVisibilityMotionTempo = useLatchedMotionTempo(');
    expect(appSource).toContain('const cameraMotionTempo = useLatchedMotionTempo(');
    expect(appSource).toContain('const characterStageMotionTempo = useLatchedMotionTempo(');
    expect(appSource).toContain('const stickerEntryExitMotionTempo = useLatchedMotionTempo(');
    expect(appSource).toContain('const stickerLayoutMotionTempo = useLatchedMotionTempo(');
    expect(appSource).toContain('const handleManualAdvance = useCallback(() => {');
    expect(appSource).toContain("current.busy && nextTempo === 'catch-up'");
    expect(appSource).toContain('queuedManualAdvanceAtRef.current = performance.now();');
    expect(appSource).toContain('isQueuedManualAdvanceFresh(queuedAt, performance.now())');
    expect(appSource).toContain('sustainCatchUp();');
    expect(appSource).toContain('data-motion-tempo={motionTempo}');
    expect(appSource).toContain('handleManualAdvance();');
    expect(appSource).toContain('resetManualAdvanceTempo();');
    expect(styles).toContain(".char-layer[data-motion-tempo='catch-up'] .char:not(.is-camera-hidden):not(.is-entering)");
    expect(styles).toContain(".sticker[data-motion-tempo='catch-up'][data-layout-motion='true']");
    expect(styles).not.toContain(".app[data-motion-tempo='catch-up'] .bg");
    expect(styles).not.toContain(".app[data-motion-tempo='catch-up'] .char.is-breathing");
    expect(styles).not.toContain(".app[data-motion-tempo='catch-up'] .char {\n");
  });

  it('animates one absolute camera scale and limits lateral travel to an explicit pan', () => {
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
    expect(styles).toContain('transform var(--stage-camera-motion-duration) var(--stage-camera-motion-easing)');
    expect(styles).toContain('var(--stage-camera-motion-delay)');
    expect(styles).toMatch(
      /\.char-camera-world\s*\{[\s\S]*?transition: none;/,
    );
    expect(styles).toMatch(
      /\.char-camera-world\[data-camera-transition='pan'\]\s*\{[\s\S]*?transition:[\s\S]*?transform var\(--stage-camera-motion-duration\)/,
    );
    expect(styles).not.toContain('transform-origin var(--stage-camera-duration)');
    expect(styles).toMatch(/\.char-composition-world,[\s\S]*?\.char-camera-world,[\s\S]*?\.char-layer,[\s\S]*?transition: none !important;/);
  });

  it('keeps close-shot companions mounted and opaque across speaker changes', () => {
    expect(appSource).toContain('resolveStageCameraTransitionTiming(');
    expect(appSource).toContain("'--stage-camera-motion-duration': `${cameraTransitionTiming.cameraDuration}ms`");
    expect(appSource).toContain("'--stage-camera-motion-delay': `${cameraTransitionTiming.cameraDelay}ms`");
    expect(styles).toContain('opacity var(--character-opacity-duration) cubic-bezier(0.2, 0.65, 0.3, 1)');
    expect(styles).toContain('visibility 0s linear var(--character-visibility-delay)');
    expect(styles).not.toContain(".char-layer[data-camera-shot='close'] .char.is-camera-listener");
    expect(appSource).not.toContain("const isCloseListener = cameraPresentation.shot === 'close'");
    expect(appSource).toContain('const rendererActive = isCameraVisible && placementReady;');
    expect(appSource).not.toContain("cameraPresentation.shot === 'close' ? (focusCharacterId ?? '') : ''");
    expect(appSource).toContain('() => `${stickerAvoidanceKey}::${promptTopBaselineReady}`');
    expect(appSource).not.toContain('`${stickerAvoidanceKey}::${speakerOrder.join(\',\')}::${promptTopBaselineReady}`');
    expect(styles).toMatch(/@keyframes characterEnter\s*\{[\s\S]*?from\s*\{[\s\S]*?opacity: 0;[\s\S]*?to\s*\{[\s\S]*?opacity: 1;/);
    const characterEnter = styles.match(/@keyframes characterEnter\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(characterEnter).not.toContain('translate');
    expect(characterEnter).not.toContain('scale');
  });

  it('keeps every staged character opaque and gives only the dialogue speaker a subtle breathing loop', () => {
    const charRule = styles.match(/^\.char\s*\{([\s\S]*?)\n\}/m)?.[1] ?? '';
    const breathingRule = styles.match(/\.char\.is-breathing\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const breathingKeyframes = styles.match(/@keyframes characterSpeakerBreathing\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(charRule).toContain('opacity: 1;');
    expect(styles).not.toContain('--char-focus-opacity');
    expect(styles).not.toContain(".char-layer[data-camera-shot='reaction'] .char.is-camera-listener");
    expect(appSource).toContain("const isSpeaking = rendererActive && dialogSpeakerId === slot.id;");
    expect(appSource).toContain("isSpeaking ? 'is-speaking' : ''");
    expect(appSource).toContain("isBreathing ? 'is-breathing' : ''");
    expect(appSource).toContain("animationName !== 'characterSpeakerBreathing'");
    expect(appSource).toContain('previousBreathingSpeakerIdRef.current === slot.id');
    expect(live2dSource).toContain('onAnimationIteration={onAnimationIteration}');
    expect(charRule).toContain('--character-breath-duration: 2200ms;');
    expect(breathingRule).toContain('characterSpeakerBreathing var(--character-breath-duration)');
    expect(breathingRule).not.toContain('opacity');
    expect(breathingKeyframes).toContain('var(--char-calibration-y) - 0.18%');
    expect(breathingKeyframes).toContain('scale: calc(var(--char-scale) + 0.003) calc(var(--char-scale) + 0.009);');
    expect(breathingKeyframes).toContain('brightness(1.04)');
    expect(breathingKeyframes).toContain('drop-shadow(0 0 12px rgba(255, 244, 218, 0.16))');
    expect(breathingKeyframes).not.toContain('transform:');
    expect(breathingKeyframes).not.toContain('opacity');
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.char,[\s\S]*?animation: none !important;/,
    );
  });

  it('warms the Live2D renderer alongside chapter asset preloading', () => {
    expect(live2dSource).toContain('export async function prepareLive2DRuntime()');
    expect(engineSource).toContain("import('./Live2DCharacter')");
    expect(engineSource).toContain('? warmLive2DRuntime()');
    expect(engineSource).toContain('const LIVE2D_READY_TIMEOUT_MS = 20000;');
  });

  it('uses one image ratio with separate duo and trio horizontal anchors', () => {
    expect(appSource.match(/data-character-count=\{visibleCharacterCount\}/g)).toHaveLength(2);
    expect(appSource).toContain('const characterStageSpacing = useMemo(');
    expect(appSource).toContain('() => resolveCharacterStageSpacing(');
    expect(appSource).toContain('layoutCharactersByPosition.map((entry) => entry.slot.calibration.spacing)');
    expect(appSource).toContain('resolveCharacterStageRenderPlacement(');
    expect(appSource).toContain("'--char-desktop-anchor-x': placement.anchorX");
    expect(appSource).toContain("'--char-mobile-anchor-x': placement.mobileAnchorX");
    expect(styles).toMatch(/\.char-layer \.char\.is-camera-hidden\s*\{[\s\S]*?--char-anchor-x: var\(--char-mobile-anchor-x/);
    expect(styles).toMatch(/\.char-image\s*\{[\s\S]*?--char-image-height: 52cqh;/);
    expect(styles).not.toMatch(/\.char-layer\.char-layout-(?:duo|trio) \.char-image/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-duo \.char-duo-left\s*\{[\s\S]*?--char-anchor-x: 25cqw;/);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.char-layer\.char-layout-trio \.left\s*\{[\s\S]*?--char-anchor-x: 25cqw;/);
    expect(styles).not.toContain("char-layout-trio[data-camera-shot='medium']");
    expect(styles).not.toContain('.char-layout-trio .char.is-camera-focus.left');
    expect(styles).not.toContain('--char-anchor-x: -10cqw');
    expect(styles).not.toContain('--char-anchor-x: 110cqw');
  });
});
