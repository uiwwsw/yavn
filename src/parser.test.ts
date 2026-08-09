import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml } from './parser';

const configYaml = (startScreen: string) => `
title: Test Game
textSpeed: 38
autoSave: true
clickToInstant: true
startScreen:
  enabled: true
${startScreen}
`;

describe('parseConfigYaml startScreen', () => {
  it('shows the engine title overlay by default', () => {
    const parsed = parseConfigYaml(configYaml('  image: assets/title.png'), 'config.yaml');

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.startScreen?.showTitle).toBe(true);
  });

  it('allows title artwork to opt out of the duplicate overlay', () => {
    const parsed = parseConfigYaml(
      configYaml(`  image: assets/title.png
  showTitle: false`),
      'config.yaml',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.startScreen?.showTitle).toBe(false);
  });
});

describe('cinematic DSL timing', () => {
  it('accepts emotional dialogue delivery', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: confrontation
scenes:
  confrontation:
    actions:
      - say:
          char: Reiko.nervous
          delivery: whisper
          text: "I did not touch it..."
`,
      '0.yaml',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.scenes.confrontation.actions[0]).toMatchObject({
      say: { delivery: 'whisper' },
    });
  });

  it('rejects unknown dialogue delivery values', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: confrontation
scenes:
  confrontation:
    actions:
      - say:
          delivery: dramatic
          text: "No."
`,
      '0.yaml',
    );

    expect(parsed.error).toBeDefined();
    expect(parsed.data).toBeUndefined();
  });

  it('accepts auto-advancing dialogue and a timed choice fallback', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: trailer
scenes:
  trailer:
    actions:
      - say:
          text: "Run."
          autoAdvance: 2400
      - choice:
          prompt: "Cut the signal?"
          timeoutMs: 7000
          timeoutOptionIndex: 1
          options:
            - text: "Wait"
            - text: "Cut"
`,
      '0.yaml',
    );

    expect(parsed.error).toBeUndefined();
    const actions = parsed.data?.data.scenes.trailer.actions ?? [];
    expect(actions[0]).toMatchObject({ say: { autoAdvance: 2400 } });
    expect(actions[1]).toMatchObject({ choice: { timeoutMs: 7000, timeoutOptionIndex: 1 } });
  });

  it('preserves root assets for reuse across public games', () => {
    const parsed = parseBaseYaml(
      `
assets:
  backgrounds:
    shared: root:/game-list/conan/assets/bg/case_board.avif
`,
      'base.yaml',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.assets?.backgrounds?.shared).toBe(
      'root:/game-list/conan/assets/bg/case_board.avif',
    );
  });
});

describe('game over DSL', () => {
  it('accepts standalone and choice-triggered game over actions', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: final_choice
scenes:
  final_choice:
    actions:
      - choice:
          prompt: "Which wire?"
          options:
            - text: "Blue"
              gameOver:
                title: "Signal lost"
                message: "The route collapsed."
            - text: "Red"
              goto: failed_scene
  failed_scene:
    actions:
      - gameOver:
          message: "Try from a save."
`,
      '0.yaml',
    );

    expect(parsed.error).toBeUndefined();
    const choiceAction = parsed.data?.data.scenes.final_choice.actions[0];
    expect('choice' in (choiceAction ?? {})).toBe(true);
    if (choiceAction && 'choice' in choiceAction) {
      expect(choiceAction.choice.options[0].gameOver).toEqual({
        title: 'Signal lost',
        message: 'The route collapsed.',
      });
    }
    expect(parsed.data?.data.scenes.failed_scene.actions[0]).toEqual({
      gameOver: { message: 'Try from a save.' },
    });
  });

  it('rejects a choice option that declares both goto and gameOver', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: invalid
scenes:
  invalid:
    actions:
      - choice:
          prompt: "Choose"
          options:
            - text: "Broken"
              goto: invalid
              gameOver:
                title: "No"
`,
      '0.yaml',
    );

    expect(parsed.data).toBeUndefined();
    expect(parsed.error?.message).toContain('choice option cannot declare both goto and gameOver');
  });
});
