import { describe, expect, it } from 'vitest';
import { parseConfigYaml } from './parser';

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
