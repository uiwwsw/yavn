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
