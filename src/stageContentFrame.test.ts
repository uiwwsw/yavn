import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const styles = readSource('./styles.css');

describe('responsive stage content frame', () => {
  it('centers gameplay content in a maximum 9:16 frame while the background stays full bleed', () => {
    expect(appSource).toContain(
      '<div ref={stageContentFrameRef} className="stage-content-frame">',
    );
    expect(styles).toMatch(
      /\.bg\s*\{[\s\S]*?inset: 0;[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?object-fit: cover;/,
    );
    expect(styles).toMatch(
      /\.stage-content-frame\s*\{[\s\S]*?top: 50%;[\s\S]*?width: 100%;[\s\S]*?height: min\(100%, calc\(100vw \* 16 \/ 9\)\);[\s\S]*?transform: translateY\(-50%\);[\s\S]*?container-type: size;/,
    );
  });

  it('measures dialogue avoidance inside the centered frame', () => {
    expect(appSource).toContain('const stageContentFrameRef = useRef<HTMLDivElement | null>(null);');
    expect(appSource).toContain(
      'Math.ceil(stageFrameEl.clientHeight - dialogEl.offsetTop)',
    );
    expect(appSource).toContain('observer.observe(stageFrameEl);');
    expect(styles).toContain('--dialog-max-height: 38cqh;');
    expect(styles).toContain('--dialog-max-height: 48cqh;');
  });
});
