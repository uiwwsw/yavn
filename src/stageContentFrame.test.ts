import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const styles = readSource('./styles.css');

describe('responsive stage content frame', () => {
  it('centers desktop gameplay between 4:3 and 16:9 while the background stays full bleed', () => {
    expect(appSource).toContain(
      "className={`stage-content-frame${settingsOpen ? ' has-settings-modal' : ''}`}",
    );
    expect(styles).toMatch(
      /\.bg\s*\{[\s\S]*?inset: 0;[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?object-fit: cover;/,
    );
    expect(styles).toMatch(
      /\.effect-viewport\s*\{[\s\S]*?container-name: stage-viewport;[\s\S]*?container-type: size;/,
    );
    expect(styles).toMatch(
      /\.stage-content-frame\s*\{[\s\S]*?top: 50%;[\s\S]*?left: 50%;[\s\S]*?width: min\(100cqw, calc\(100cqh \* 16 \/ 9\)\);[\s\S]*?height: min\(100cqh, calc\(100cqw \* 3 \/ 4\)\);[\s\S]*?transform: translate\(-50%, -50%\);[\s\S]*?container-name: stage-content;[\s\S]*?container-type: size;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 768px\) and \(orientation: portrait\)[\s\S]*?\.stage-content-frame\s*\{[\s\S]*?width: 100cqw;[\s\S]*?height: min\(100cqh, calc\(100cqw \* 16 \/ 9\)\);/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 768px\) and \(orientation: portrait\)[\s\S]*?\.stage-content-frame\.has-settings-modal\s*\{[\s\S]*?height: 100%;/,
    );
  });

  it('uses responsive absolute camera scales and target pans', () => {
    expect(appSource).toContain(
      "'--stage-camera-origin-y-mobile': `${cameraPresentation.mobileOriginY}%`",
    );
    expect(appSource).toContain("'--stage-camera-scale-mobile': cameraPresentation.mobileScale");
    expect(appSource).toContain("'--stage-camera-pan-x-mobile': cameraPresentation.mobilePanX");
    expect(styles).toMatch(
      /@media \(max-width: 768px\)[\s\S]*?\.char-composition-world\s*\{[\s\S]*?--stage-camera-render-scale: var\(--stage-camera-scale-mobile\);[\s\S]*?--stage-camera-render-pan-x: var\(--stage-camera-pan-x-mobile\);/,
    );
  });

  it('normalizes static actor height across mobile and desktop play frames', () => {
    expect(styles).toContain('--char-image-height: 52cqh;');
    expect(styles).not.toMatch(/\.char-layer\.char-layout-(?:duo|trio) \.char-image/);
    expect(styles).toContain('--char-live2d-width: min(36cqw, 52cqh);');
    expect(styles).toMatch(/\.char-image\s*\{[\s\S]*?width: auto;[\s\S]*?height: var\(--char-image-height\);[\s\S]*?max-height: none;/);
    expect(styles).not.toContain('--char-image-height: 52vh;');
    expect(styles).not.toMatch(/--char-image-width: min\([^;]+, [0-9]+px\)/);
  });

  it('measures sticker avoidance inside the centered frame without moving the character stage', () => {
    const characterLayerRules = styles.match(/\.char-layer\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(appSource).toContain('const stageContentFrameRef = useRef<HTMLDivElement | null>(null);');
    expect(appSource).toContain(
      'Math.ceil(stageFrameEl.clientHeight - dialogEl.offsetTop)',
    );
    expect(appSource).toContain('observer.observe(stageFrameEl);');
    expect(appSource).not.toContain('choiceGate.active, dialog.visibleText, inputGate.active');
    expect(appSource).not.toMatch(/className=\{`char-layer[\s\S]{0,400}style=\{\{ bottom:/);
    expect(appSource).toContain("style={{ '--sticker-dialog-inset': `${stickerSafeInset}px` } as CSSProperties}");
    expect(characterLayerRules).not.toContain('transition: bottom');
    expect(styles).toMatch(
      /\.sticker-safe-frame\s*\{[\s\S]*?bottom: calc\(var\(--stage-safe-block-end\) \+ var\(--sticker-dialog-inset\)\);/,
    );
    expect(styles).not.toMatch(/\.sticker-layer\s*\{[^}]*transition: bottom/);
    expect(styles).toContain('--dialog-max-height: 38cqh;');
    expect(styles).toContain('--dialog-max-height: 48cqh;');
  });
});
