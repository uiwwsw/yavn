import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const backgroundTransitionSource = readSource('./BackgroundTransition.tsx');
const engineSource = readSource('./engine.ts');
const live2dSource = readSource('./Live2DCharacter.tsx');
const styles = readSource('./styles.css');

describe('transition performance guards', () => {
  it('keeps high-frequency typing updates out of the full application tree', () => {
    expect(appSource).toContain('const DialogueText = memo(function DialogueText()');
    expect(appSource).toContain('visibleText: state.dialog.visibleText');
    expect(appSource).toContain('<DialogueText />');
    expect(appSource).toContain('useVNStore(useShallow((state) => ({');
    expect(appSource).not.toContain('} = useVNStore();');
    expect(appSource).toContain('const StickerView = memo(function StickerView(');
  });

  it('aligns typing work to paint frames and batches overdue glyphs', () => {
    expect(engineSource).toContain('let typeFrame: number | undefined;');
    expect(engineSource).toContain('typeFrame = window.requestAnimationFrame(stepTyping);');
    expect(engineSource).toContain('while (stepIndex < plan.length && timestamp >= nextStepAt)');
    expect(engineSource).not.toContain('let typeTimer: number | undefined;');
  });

  it('promotes camera and actor layers only for the active motion window', () => {
    expect(appSource).toContain('function useTransientMotionWindow(');
    expect(appSource.match(/data-camera-moving=\{cameraMotionActive/g)).toHaveLength(2);
    expect(appSource.match(/data-character-moving=\{characterMotionActive/g)).toHaveLength(2);
    expect(styles).toMatch(
      /\.char-composition-world\s*\{[\s\S]*?will-change: auto;/,
    );
    expect(styles).toMatch(
      /\.char-layer\[data-camera-moving='true'\] \.char-composition-world,[\s\S]*?will-change: transform;/,
    );
    expect(styles).toMatch(
      /\.char-layer\[data-character-moving='true'\] \.char\s*\{[\s\S]*?will-change: translate, scale, opacity;/,
    );
    expect(backgroundTransitionSource).toContain('const BackgroundTransition = memo(');
    expect(backgroundTransitionSource).toContain('data-background-transitioning={transitioning');
    expect(styles).toMatch(
      /\.bg\s*\{[\s\S]*?will-change: auto;/,
    );
    expect(styles).toMatch(
      /\.bg\[data-background-transitioning='true'\]\s*\{[\s\S]*?will-change: opacity;/,
    );
  });

  it('parks hidden Live2D renderers and coalesces backing-canvas resize storms', () => {
    expect(appSource).toContain('active={rendererActive && !settingsOpen}');
    expect(live2dSource).toContain('shouldRunLive2DTicker(');
    expect(live2dSource).toContain('resolveLive2DCanvasPixelRatio(');
    expect(live2dSource).toContain('new ResizeObserver(scheduleResize)');
    expect(live2dSource).toContain('}, LIVE2D_RESIZE_QUIET_MS);');
  });

  it('defers next-chapter warming and pauses background motion behind settings', () => {
    expect(engineSource).toContain('idleWindow.requestIdleCallback(warm, { timeout: 3000 })');
    expect(engineSource).toContain('nextChapterWarmHandle = window.setTimeout(warm, 1200)');
    expect(engineSource).not.toContain('}, 300);');
    expect(engineSource).toContain('window.requestAnimationFrame(tick)');
    expect(engineSource).not.toContain('window.setInterval(tick, 32)');
    expect(appSource).toContain('setPlayerAutoPlayPaused(settingsOpen || dialogUiHidden)');
    expect(styles).toMatch(
      /\.stage-content-frame\.has-settings-modal \.char,[\s\S]*?animation-play-state: paused !important;/,
    );
    expect(styles).toMatch(
      /\.dialog-box\s*\{[\s\S]*?overflow: visible;/,
    );
  });
});
