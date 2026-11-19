import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { load as parseYaml } from 'js-yaml';
import { actionSchema } from './schema';

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
const appSource = read('./App.tsx');
const engineSource = read('./engine.ts');
const styles = read('./styles.css');

// 액션 하나만 검사한다. 게임 전체 스키마를 쓰면 meta·settings가 없어서
// 통과해야 할 것도 실패하고, 실패해야 할 것도 엉뚱한 이유로 실패한다.
const parseAction = (yaml: string) => {
  const parsed = parseYaml(`actions:\n${yaml}`) as { actions: unknown[] };
  return actionSchema.safeParse(parsed.actions[0]);
};

describe('mood: a feeling the screen holds', () => {
  it('stays up until something takes it down, unlike the one-shot effect', () => {
    // The effect action clears itself on a timer; mood is only cleared by another mood.
    expect(engineSource).toMatch(/if \('mood' in action\)[\s\S]*?setMood\(undefined\)/);
    expect(engineSource).toMatch(/if \('mood' in action\)[\s\S]*?tremor: action\.mood\.tremor === true/);
    expect(engineSource).not.toMatch(/setMood\(undefined\), EFFECT_DURATIONS/);
  });

  it('accepts a tone with a level and a tremor, and "off"', () => {
    expect(parseAction("      - mood: { tone: ember, level: 3, tremor: true }").success).toBe(true);
    expect(parseAction("      - mood: off").success).toBe(true);
    expect(parseAction("      - mood: { tone: ember, level: 9 }").success).toBe(false);
    expect(parseAction("      - mood: { tone: ember, scale: 2 }").success).toBe(false);
  });

  it('paints a layer of its own rather than fighting the effect pseudo-elements', () => {
    // .effect-viewport::before and ::after both already belong to the effect system.
    expect(appSource).toContain('<div className="mood-wash" aria-hidden="true" />');
    expect(styles).toMatch(/\.mood-wash\s*\{[\s\S]*?pointer-events: none;/);
    expect(styles).toMatch(/\.effect-viewport\[data-mood-level='3'\] \.mood-wash \{ opacity: var\(--mood-a3/);
  });

  it('gets quieter for players who asked for fewer effects, and stops for reduced motion', () => {
    expect(styles).toMatch(/\[data-effect-level='reduced'\] \.mood-wash \{ opacity: 0\.12 !important; \}/);
    expect(styles).toMatch(/\[data-effect-level='minimal'\] \.mood-wash \{ display: none; \}/);
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.effect-viewport\[data-mood-tremor='true'\] \.bg,[\s\S]*?animation: none !important;/,
    );
  });

  it('shakes the picture only, so the HUD and the dialogue stay put', () => {
    expect(styles).toMatch(
      /\.effect-viewport\[data-mood-tremor='true'\] \.bg,\s*\.effect-viewport\[data-mood-tremor='true'\] \.char \{/,
    );
    expect(styles).not.toMatch(/\[data-mood-tremor='true'\] \.dialog-box/);
    // A transform on the frame would make it the containing block for everything fixed
    // inside it, and the HUD would ride along with the shake.
    expect(styles).not.toMatch(/\[data-mood-tremor='true'\][^{]*\.stage-content-frame/);
  });

  it('stays under the dialogue box so the colour never sits on the words', () => {
    const washZ = /\.mood-wash \{[\s\S]*?z-index: (\d+);/.exec(styles);
    const stageZ = /^\.stage-content-frame \{[\s\S]*?z-index: (\d+);/m.exec(styles);
    expect(washZ && stageZ).toBeTruthy();
    expect(Number(washZ![1])).toBeLessThan(Number(stageZ![1]));
  });
});

describe('approach: a choice you walk toward', () => {
  const approach = `      - choice:
          presentation: approach
          prompt: 당기는 쪽이 있다.
          mood: ember
          options:
            - text: 노란 점
              at: { x: 30, y: 40 }
              reveal: ["점이다.", "노란 것이 섞여 있다."]
              goto: s`;

  it('takes positioned options with reveal steps', () => {
    expect(parseAction(approach).success).toBe(true);
  });

  it('refuses reveal steps outside an approach, and an approach with no steps', () => {
    expect(parseAction(approach.replace('presentation: approach', 'presentation: explore')).success).toBe(false);
    expect(parseAction(approach.replace(/\n *reveal: .*/, '')).success).toBe(false);
  });

  it('accepts an explicit click count with optional reveal text and rejects incompatible rules', () => {
    const configured = approach.replace('presentation: approach', 'presentation: approach\n          clicks: 3');
    expect(parseAction(configured).success).toBe(true);
    expect(parseAction(configured.replace(/\n *reveal: .*/, '')).success).toBe(true);
    expect(parseAction(configured.replace('clicks: 3', 'clicks: 2')).success).toBe(false);
    expect(parseAction(configured.replace('clicks: 3', 'clicks: 3\n          timeoutMs: 2000')).success).toBe(false);
  });

  it('deepens the colour with each step while keeping the image still', () => {
    expect(engineSource).toMatch(/const level = Math\.min\(3, taken \+ 1\);/);
    expect(engineSource).toMatch(/setMood\(\{ tone, level, tremor: false \}\)/);
  });

});
