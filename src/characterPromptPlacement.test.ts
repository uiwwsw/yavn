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

describe('prompt-top character placement', () => {
  it('partitions characters into exclusive stage and prompt compositions', () => {
    expect(appSource).toContain("entry.slot.placement === 'prompt-top'");
    expect(appSource).toContain("renderPlacement: CharacterSlot['placement'] = 'stage-bottom'");
    expect(appSource).toContain('if (!slot || slot.placement !== renderPlacement)');
    expect(appSource).toContain('className={`char-layer char-layer-stage-bottom');
    expect(appSource).toContain('className={`char-layer char-layer-prompt-top');
    expect(appSource).toContain('className="char-composition-world char-composition-world-prompt-top"');
    expect(appSource).toContain('className="char-camera-world char-camera-world-prompt-top"');
    expect(appSource).toContain("renderCharacter(characters.left, 'left', 'prompt-top')");
    expect(appSource).toContain("renderCharacter(characters.center, 'center', 'prompt-top')");
    expect(appSource).toContain("renderCharacter(characters.right, 'right', 'prompt-top')");
  });

  it('shares one horizontal composition across mixed baselines', () => {
    expect(appSource).toMatch(
      /const characterStageLayout = useMemo\([\s\S]*?resolveCharacterStageLayout\(\s*layoutCharactersByPosition\.map/,
    );
    expect(appSource).not.toContain('promptTopCharacterStageLayout');
    expect(appSource.match(/data-character-count=\{visibleCharacterCount\}/g)).toHaveLength(2);
    expect(appSource).toContain(
      "className={`char-layer char-layer-stage-bottom${characterStageLayout.mode === 'default'",
    );
    expect(appSource).toContain(
      "className={`char-layer char-layer-prompt-top${characterStageLayout.mode === 'default'",
    );
    expect(appSource).toContain('resolveCharacterStageRenderPlacement(\n      position,\n      characterStageLayout,');
    expect(appSource).toContain('const focusedCharacterPlacement = stagedCharactersByPosition.find(');
    expect(appSource).toContain("focusedCharacterPlacement === 'prompt-top' ? 2 : 3");
    expect(appSource).toContain("focusedCharacterPlacement === 'stage-bottom' ? 2 : 3");
  });

  it('anchors the prompt composition to the measured dialog top without an initial jump', () => {
    expect(appSource).toContain('Math.ceil(stageFrameEl.clientHeight - dialogEl.offsetTop)');
    expect(appSource).toContain('if (dialogUiHidden)');
    expect(appSource).toContain('}, [dialogUiHidden]);');
    expect(appSource).toContain('const promptTopBaselineReady = isDialogHidden || stickerSafeInset > 0;');
    expect(appSource).toContain("data-baseline-ready={promptTopBaselineReady ? 'true' : 'false'}");
    expect(appSource).toContain('aria-hidden={!promptTopBaselineReady}');
    expect(appSource).toContain("'--prompt-top-dialog-inset': `${stickerSafeInset}px`");
    expect(styles).toMatch(
      /\.char-layer-prompt-top\s*\{[\s\S]*?bottom: var\(--prompt-top-dialog-inset\);[\s\S]*?z-index: 3;/,
    );
    expect(styles).toMatch(
      /\.char-layer-prompt-top\[data-baseline-ready='false'\]\s*\{[\s\S]*?visibility: hidden;/,
    );
    expect(styles).toMatch(
      /\.char-layer-prompt-top\[data-baseline-ready='false'\] \.char\s*\{[\s\S]*?animation-play-state: paused;/,
    );
  });

  it('keeps zoom and pan transitions on a bottom-pinned prompt camera world', () => {
    expect(appSource.match(/style=\{cameraStyle\}/g)).toHaveLength(2);
    expect(appSource.match(/data-camera-target=\{camera\.target\}/g)).toHaveLength(2);
    expect(appSource.match(/data-camera-transition=\{cameraPresentation\.transition\}/g)).toHaveLength(2);
    expect(styles).toMatch(
      /\.char-composition-world\.char-composition-world-prompt-top\s*\{[\s\S]*?--stage-camera-render-origin-y: 100%;[\s\S]*?transform-origin: 50cqw 100%;/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.char-composition-world,[\s\S]*?\.char-camera-world,[\s\S]*?\.char-layer,[\s\S]*?transition: none !important;/,
    );
  });

  it('keeps the focused actor in front when stage and prompt placements are mixed', () => {
    expect(appSource).toContain("const stageBottomLayerZIndex = focusedCharacterPlacement === 'prompt-top' ? 2 : 3;");
    expect(appSource).toContain("const promptTopLayerZIndex = focusedCharacterPlacement === 'stage-bottom' ? 2 : 3;");
    expect(appSource).toContain('style={{ zIndex: stageBottomLayerZIndex }}');
    expect(appSource).toContain('zIndex: promptTopLayerZIndex');
  });
});
