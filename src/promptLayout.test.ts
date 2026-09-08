import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseChapterYaml, parseConfigYaml } from './parser';
import {
  DEFAULT_PROMPT_HEIGHT_PX,
  resolveGamePromptHeight,
  resolveInteractivePromptHeight,
  resolvePromptActorInset,
  resolvePromptActionHeight,
} from './promptLayout';
import type { Action, GameData } from './types';

const promptStyles = readFileSync(fileURLToPath(new URL('./promptLayout.css', import.meta.url)), 'utf8');
const appSource = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
const baseStyles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

describe('stable prompt layout', () => {
  it('accepts a game-level prompt height and falls back to the engine default', () => {
    const parsed = parseConfigYaml(`
      title: Prompt test
      textSpeed: 25
      autoSave: true
      clickToInstant: true
      ui:
        template: paper-stage
        promptHeight: 220
    `, 'config.yaml');

    expect(parsed.error).toBeUndefined();
    expect((parsed.data?.data.ui as { promptHeight?: number } | undefined)?.promptHeight).toBe(220);
    expect(resolveGamePromptHeight(undefined)).toBe(DEFAULT_PROMPT_HEIGHT_PX);
    expect(resolveGamePromptHeight({ ui: { promptHeight: 240 } } as unknown as GameData)).toBe(240);
  });

  it('supports per-content overrides for say, choice, and input actions', () => {
    const parsed = parseChapterYaml(`
      script:
        - scene: start
      scenes:
        start:
          actions:
            - say:
                text: 첫 문장
                promptHeight: 190
            - choice:
                prompt: 고르세요
                promptHeight: 260
                options:
                  - text: 계속
                    goto: next
            - input:
                prompt: 입력하세요
                promptHeight: 230
                correct: 정답
                errors: [다시]
            - goto: next
        next:
          actions:
            - ending: done
    `, '0.yaml');

    expect(parsed.error).toBeUndefined();
    const actions = parsed.data?.data.scenes.start.actions ?? [];
    expect(resolvePromptActionHeight(actions[0] as Action)).toEqual({ isPromptAction: true, promptHeight: 190 });
    expect(resolvePromptActionHeight(actions[1] as Action)).toEqual({ isPromptAction: true, promptHeight: 260 });
    expect(resolvePromptActionHeight(actions[2] as Action)).toEqual({ isPromptAction: true, promptHeight: 230 });
    expect(resolvePromptActionHeight(actions[3] as Action)).toEqual({ isPromptAction: false });
  });

  it('rejects unsafe prompt heights', () => {
    const config = parseConfigYaml(`
      title: Prompt test
      textSpeed: 25
      autoSave: true
      clickToInstant: true
      ui:
        template: paper-stage
        promptHeight: 80
    `, 'config.yaml');
    expect(config.error?.message).toContain('Schema validation failed');

    const chapter = parseChapterYaml(`
      script:
        - scene: start
      scenes:
        start:
          actions:
            - say:
                text: 너무 작음
                promptHeight: 80
    `, '0.yaml');
    expect(chapter.error?.message).toContain('Schema validation failed');
  });

  it('keeps the outer shell fixed and scrolls overflowing prompt content internally', () => {
    expect(promptStyles).toContain('--yavn-prompt-height: 170px');
    expect(promptStyles).toMatch(/\.dialog-box\s*\{[\s\S]*?height: min\(var\(--yavn-prompt-height/);
    expect(promptStyles).toMatch(/\.dialog-box\.has-choice-gate\s*\{[\s\S]*?height: min\(var\(--yavn-prompt-height/);
    expect(promptStyles).toMatch(/\.dialog-content-scroll\s*\{[\s\S]*?overflow-y: auto;/);
    expect(promptStyles).toMatch(/\.dialog-content-scroll\s*> \.speaker,[\s\S]*?position: absolute;/);
  });

  it('uses the full prompt body without reserving a footer status row', () => {
    const dialogBoxRule = baseStyles.match(/^\.dialog-box\s*\{([\s\S]*?)\n\}/m)?.[1] ?? '';

    expect(dialogBoxRule).toContain('grid-template-rows: minmax(0, 1fr);');
    expect(dialogBoxRule).not.toContain('gap: 10px;');
    expect(appSource).not.toContain('className="status"');
    expect(baseStyles).not.toMatch(/^\.status\s*\{/m);
  });
});


describe('interactive prompt sizing', () => {
  const choice = { choice: { prompt: 'Choose', options: Array.from({ length: 4 }, (_, i) => ({ text: String(i) })) } } as Action;
  it('gives stacked mobile options more space than desktop columns', () => {
    expect(resolveInteractivePromptHeight(undefined, choice, true)).toBe(408);
    expect(resolveInteractivePromptHeight(undefined, choice, false)).toBe(280);
    const timed = { choice: { ...(choice as { choice: object }).choice, timeoutMs: 10000 } } as Action;
    expect(resolveInteractivePromptHeight(undefined, timed, false)).toBe(316);
  });
  it('preserves author sizes over automatic choice sizing', () => {
    const game = { ui: { promptHeight: 240 } } as GameData;
    expect(resolveInteractivePromptHeight(game, choice, true)).toBe(240);
    const explicit = { choice: { ...(choice as { choice: object }).choice, promptHeight: 330 } } as Action;
    expect(resolveInteractivePromptHeight(game, explicit, true)).toBe(330);
  });
  it('caps automatic rows and reserves space for text input', () => {
    const many = { choice: { prompt: 'Choose', options: Array.from({ length: 20 }, () => ({ text: 'next' })) } } as Action;
    expect(resolveInteractivePromptHeight(undefined, many, true)).toBe(408);
    const five = { choice: { prompt: 'Choose', options: Array.from({ length: 5 }, () => ({ text: 'next' })) } } as Action;
    expect(resolveInteractivePromptHeight(undefined, five, false)).toBe(408);
    expect(resolveInteractivePromptHeight(undefined, { input: { prompt: 'Name', routes: [], correct: 'x', errors: [] } } as Action, false)).toBe(220);
    expect(resolveInteractivePromptHeight(undefined, { say: { text: 'Hello' } } as Action, false)).toBe(170);
  });
  it('keeps prompt-top actors still when automatic choices expand over the stage', () => {
    expect(resolvePromptActorInset(194, 170, 170)).toBe(194);
    expect(resolvePromptActorInset(432, 408, 170)).toBe(194);
    expect(resolvePromptActorInset(304, 280, 170)).toBe(194);
    expect(resolvePromptActorInset(304, 280, 280)).toBe(304);
    expect(resolvePromptActorInset(134, 110, 170)).toBe(134);
  });
});
