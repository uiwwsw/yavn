import { describe, expect, it } from 'vitest';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';

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

  it('normalizes a game-specific start title color', () => {
    const parsed = parseConfigYaml(
      configYaml(`  image: assets/title.png
  titleColor: "  #ffe0a3  "`),
      'config.yaml',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.startScreen?.titleColor).toBe('#ffe0a3');
  });

  it('normalizes desktop and mobile start artwork positions', () => {
    const parsed = parseConfigYaml(
      configYaml(`  image: assets/title.png
  imagePosition: " 50% 45% "
  mobileImagePosition: " 72% 50% "`),
      'config.yaml',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.startScreen?.imagePosition).toBe('50% 45%');
    expect(parsed.data?.data.startScreen?.mobileImagePosition).toBe('72% 50%');
  });
});

describe('parseConfigYaml legal notices', () => {
  it('preserves reusable legal notices in resolved game metadata', () => {
    const config = parseConfigYaml(
      `
title: Licensed Sample
textSpeed: 38
autoSave: true
clickToInstant: true
legalNotices:
  - id: sample-character
    title: Sample character
    copyright: © Example Inc.
    text: This game uses a third-party sample character.
    links:
      - label: Official terms
        href: https://example.com/license
`,
      'config.yaml',
    );
    const chapter = parseChapterYaml(
      `
script:
  - scene: intro
scenes:
  intro:
    actions:
      - say: { text: "Hello." }
`,
      '0.yaml',
    );

    expect(config.error).toBeUndefined();
    expect(chapter.error).toBeUndefined();
    if (!config.data || !chapter.data) return;
    const resolved = resolveChapterGame({ config: config.data, bases: [], chapter: chapter.data });
    expect(resolved.error).toBeUndefined();
    expect(resolved.data?.meta.legalNotices).toEqual([
      {
        id: 'sample-character',
        title: 'Sample character',
        copyright: '© Example Inc.',
        text: 'This game uses a third-party sample character.',
        links: [{ label: 'Official terms', href: 'https://example.com/license' }],
      },
    ]);
  });

  it('rejects duplicate notice ids', () => {
    const parsed = parseConfigYaml(
      `
title: Invalid notices
textSpeed: 38
autoSave: true
clickToInstant: true
legalNotices:
  - { id: duplicate, title: First, text: First notice }
  - { id: duplicate, title: Second, text: Second notice }
`,
      'config.yaml',
    );

    expect(parsed.data).toBeUndefined();
    expect(parsed.error?.message).toContain("duplicate legal notice id 'duplicate'");
  });

  it('rejects non-http notice links', () => {
    const parsed = parseConfigYaml(
      `
title: Unsafe link
textSpeed: 38
autoSave: true
clickToInstant: true
legalNotices:
  - id: unsafe
    title: Unsafe link
    text: This link must not execute script.
    links:
      - { label: Unsafe, href: "javascript:alert(1)" }
`,
      'config.yaml',
    );

    expect(parsed.data).toBeUndefined();
    expect(parsed.error?.message).toContain('legal notice links must use http or https');
  });
});

describe('cinematic DSL timing', () => {
  it('accepts a character-level default dialogue delivery', () => {
    const parsed = parseBaseYaml(
      `
assets:
  characters:
    Deokman:
      base: assets/deokman.webp
      facing: left
      defaultDelivery: deduction
`,
      'base.yaml',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.assets?.characters?.Deokman).toMatchObject({
      facing: 'left',
      defaultDelivery: 'deduction',
    });
  });

  it('accepts calibrated full, bust, and close-up framings from one character image', () => {
    const base = parseBaseYaml(
      `
assets:
  characters:
    Deokman:
      base: assets/deokman.webp
      defaultFraming: full
      framings:
        full:
          scale: 1
        bust:
          scale: 1.55
          x: 2
          y: -3
        closeup:
          scale: 2.05
          y: -6
`,
      'base.yaml',
    );
    const chapter = parseChapterYaml(
      `
script:
  - scene: confrontation
scenes:
  confrontation:
    actions:
      - char:
          id: Deokman
          position: center
          framing: full
      - say:
          char: Deokman
          framing: closeup
          text: "Look at me."
`,
      '0.yaml',
    );

    expect(base.error).toBeUndefined();
    expect(base.data?.data.assets?.characters?.Deokman).toMatchObject({
      defaultFraming: 'full',
      framings: {
        full: { scale: 1 },
        bust: { scale: 1.55, x: 2, y: -3 },
        closeup: { scale: 2.05, y: -6 },
      },
    });
    expect(chapter.error).toBeUndefined();
    expect(chapter.data?.data.scenes.confrontation.actions).toMatchObject([
      { char: { framing: 'full' } },
      { say: { framing: 'closeup' } },
    ]);
  });

  it('accepts character calibration and shared stage-camera shots', () => {
    const config = parseConfigYaml(configYaml('  image: assets/title.png'), 'config.yaml');
    const base = parseBaseYaml(
      `
assets:
  characters:
    Deokman:
      base: assets/deokman.webp
      calibration: { scale: 1.08, x: 1, y: -3, spacing: 0.92 }
`,
      'base.yaml',
    );
    const chapter = parseChapterYaml(
      `
script:
  - scene: confrontation
scenes:
  confrontation:
    actions:
      - camera: wide
      - say:
          char: Deokman
          camera: medium
          text: "Stay where you are."
      - camera:
          shot: reaction
          target: Deokman
          transition: pan
          duration: 460
`,
      '0.yaml',
    );

    expect(base.data?.data.assets?.characters?.Deokman?.calibration).toEqual({
      scale: 1.08,
      x: 1,
      y: -3,
      spacing: 0.92,
    });
    expect(chapter.data?.data.scenes.confrontation.actions).toMatchObject([
      { camera: { shot: 'wide' } },
      { say: { camera: { shot: 'medium' } } },
      { camera: { shot: 'reaction', target: 'Deokman', transition: 'pan', duration: 460 } },
    ]);
    expect(config.data).toBeDefined();
    expect(base.data).toBeDefined();
    expect(chapter.data).toBeDefined();
    if (!config.data || !base.data || !chapter.data) return;
    expect(resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data }).error)
      .toBeUndefined();
  });

  it('rejects an unknown explicit camera target', () => {
    const config = parseConfigYaml(configYaml('  image: assets/title.png'), 'config.yaml');
    const base = parseBaseYaml(
      `
assets:
  characters:
    Deokman:
      base: assets/deokman.webp
`,
      'base.yaml',
    );
    const chapter = parseChapterYaml(
      `
script:
  - scene: confrontation
scenes:
  confrontation:
    actions:
      - camera: { shot: close, target: Missing }
`,
      '0.yaml',
    );

    if (!config.data || !base.data || !chapter.data) return;
    const resolved = resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data });
    expect(resolved.error?.message).toContain("missing camera target 'Missing'");
  });

  it('rejects a default framing that is not declared on the character', () => {
    const parsed = parseBaseYaml(
      `
assets:
  characters:
    Deokman:
      base: assets/deokman.webp
      defaultFraming: bust
      framings:
        full:
          scale: 1
`,
      'base.yaml',
    );

    expect(parsed.data).toBeUndefined();
    expect(parsed.error?.message).toContain("references missing framing 'bust'");
  });

  it('rejects an action framing that the referenced character does not declare', () => {
    const config = parseConfigYaml(configYaml('  image: assets/title.png'), 'config.yaml');
    const base = parseBaseYaml(
      `
assets:
  characters:
    Deokman:
      base: assets/deokman.webp
      defaultFraming: full
      framings:
        full: { scale: 1 }
`,
      'base.yaml',
    );
    const chapter = parseChapterYaml(
      `
script:
  - scene: confrontation
scenes:
  confrontation:
    actions:
      - say:
          char: Deokman
          framing: closeup
          text: "Look at me."
`,
      '0.yaml',
    );

    expect(config.data).toBeDefined();
    expect(base.data).toBeDefined();
    expect(chapter.data).toBeDefined();
    if (!config.data || !base.data || !chapter.data) return;
    const resolved = resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data });
    expect(resolved.data).toBeUndefined();
    expect(resolved.error?.message).toContain("uses missing framing 'closeup'");
  });

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

  it('accepts authored dialogue channels and conditional dialogue or choice options', () => {
    const config = parseConfigYaml(
      `
title: Channel Test
textSpeed: 30
autoSave: true
clickToInstant: true
`,
      'config.yaml',
    );
    const base = parseBaseYaml(
      `
state:
  found_record: false
`,
      'base.yaml',
    );
    const chapter = parseChapterYaml(
      `
script:
  - scene: archive
scenes:
  archive:
    actions:
      - say:
          channel: record
          when: { var: found_record, op: eq, value: true }
          text: "The archive changed."
      - choice:
          prompt: "Read it?"
          options:
            - text: "Read the hidden line"
              when: { var: found_record, op: eq, value: true }
            - text: "Leave"
`,
      '0.yaml',
    );

    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    expect(chapter.error).toBeUndefined();
    if (!config.data || !base.data || !chapter.data) return;
    expect(resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data }).error).toBeUndefined();
    expect(chapter.data.data.scenes.archive.actions[0]).toMatchObject({
      say: {
        channel: 'record',
        when: { var: 'found_record', op: 'eq', value: true },
      },
    });
    const choiceAction = chapter.data.data.scenes.archive.actions[1];
    expect(choiceAction && 'choice' in choiceAction ? choiceAction.choice.options[0].when : undefined).toEqual({
      var: 'found_record',
      op: 'eq',
      value: true,
    });
  });

  it('rejects a conditional line that references an unknown state key', () => {
    const config = parseConfigYaml(
      `
title: Conditional Dialogue Test
textSpeed: 30
autoSave: true
clickToInstant: true
`,
      'config.yaml',
    );
    const base = parseBaseYaml(
      `
state:
  known_clue: false
`,
      'base.yaml',
    );
    const chapter = parseChapterYaml(
      `
script:
  - scene: archive
scenes:
  archive:
    actions:
      - say:
          when: { var: missing_clue, op: eq, value: true }
          text: "This line must not compile."
`,
      '0.yaml',
    );

    expect(config.error).toBeUndefined();
    expect(base.error).toBeUndefined();
    expect(chapter.error).toBeUndefined();
    if (!config.data || !base.data || !chapter.data) return;
    expect(resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data }).error?.message)
      .toContain("unknown state variable or inventory item 'missing_clue' in say.when");
  });

  it('rejects unknown dialogue channels', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: archive
scenes:
  archive:
    actions:
      - say:
          channel: cinematic
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
          unskippable: true
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
    expect(actions[0]).toMatchObject({ say: { unskippable: true, autoAdvance: 2400 } });
    expect(actions[1]).toMatchObject({ choice: { timeoutMs: 7000, timeoutOptionIndex: 1 } });
  });

  it('rejects non-boolean unskippable dialogue settings', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: trailer
scenes:
  trailer:
    actions:
      - say:
          text: "Read this to the end."
          unskippable: "yes"
`,
      '0.yaml',
    );

    expect(parsed.error).toBeDefined();
    expect(parsed.data).toBeUndefined();
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
                recoverToChoice: "earlier-warning"
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
        recoverToChoice: 'earlier-warning',
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

describe('runtime safety validation', () => {
  it('keeps legacy effects and accepts an effect that waits for completion', () => {
    const parsed = parseChapterYaml(
      `
script:
  - scene: intro
scenes:
  intro:
    actions:
      - effect: flash
      - effect:
          name: impact
          wait: true
`,
      '0.yaml',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.data.scenes.intro.actions).toEqual([
      { effect: 'flash' },
      { effect: { name: 'impact', wait: true } },
    ]);
  });

  it('rejects ambiguous action rows and out-of-range timed choices', () => {
    const ambiguous = parseChapterYaml(
      `
script:
  - scene: intro
scenes:
  intro:
    actions:
      - effect: flash
        wait: 100
`,
      '0.yaml',
    );
    const invalidTimeout = parseChapterYaml(
      `
script:
  - scene: intro
scenes:
  intro:
    actions:
      - choice:
          prompt: Choose
          timeoutMs: 3000
          timeoutOptionIndex: 2
          options:
            - text: One
            - text: Two
`,
      '0.yaml',
    );

    expect(ambiguous.error?.message).toContain('exactly one action key');
    expect(invalidTimeout.error?.message).toContain('timeoutOptionIndex must be between 0 and 1');
  });

  it('rejects duplicate script order and branch scenes that can fall back to the opening', () => {
    const config = parseConfigYaml(
      `
title: Safety Test
textSpeed: 30
autoSave: true
clickToInstant: true
`,
      'config.yaml',
    );
    const duplicateScript = parseChapterYaml(
      `
script:
  - scene: intro
  - scene: intro
scenes:
  intro:
    actions:
      - say: { text: Hello }
`,
      '0.yaml',
    );
    const fallingBranch = parseChapterYaml(
      `
script:
  - scene: intro
scenes:
  intro:
    actions:
      - goto: branch_scene
  branch_scene:
    actions:
      - say: { text: This scene forgot its exit. }
`,
      '0.yaml',
    );

    expect(config.data).toBeDefined();
    expect(duplicateScript.data).toBeDefined();
    expect(fallingBranch.data).toBeDefined();
    if (!config.data || !duplicateScript.data || !fallingBranch.data) return;

    expect(
      resolveChapterGame({ config: config.data, bases: [], chapter: duplicateScript.data }).error?.message,
    ).toContain("duplicate scene 'intro'");
    expect(
      resolveChapterGame({ config: config.data, bases: [], chapter: fallingBranch.data }).error?.message,
    ).toContain("scene 'branch_scene' is outside script and can fall through");
  });
});
