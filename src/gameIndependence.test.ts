import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const runtimeFiles = [
  'src/App.tsx',
  'src/engine.ts',
  'src/parser.ts',
  'src/schema.ts',
  'src/store.ts',
  'src/styles.css',
  'src/launcherPresentation.ts',
  'scripts/generate-game-list-manifest.mjs',
];

const forbiddenSampleRules = [
  { pattern: /\bconan\b/i, label: 'sample game id: conan' },
  { pattern: /\bconan-demo\b/i, label: 'sample game id: conan-demo' },
  { pattern: /\blive2dtest\b/i, label: 'sample game id: live2dtest' },
  { pattern: /코난|코고로|미란/, label: 'sample character name' },
  { pattern: /\bengine-showcase\b/i, label: 'sample tag: engine-showcase' },
  { pattern: /\bis-live2d\b/i, label: 'sample-specific CSS class: is-live2d' },
];

describe('game-independent runtime', () => {
  it('does not branch on bundled sample ids or presentation tags', () => {
    for (const relativePath of runtimeFiles) {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
      for (const rule of forbiddenSampleRules) {
        expect(source, `${relativePath} contains ${rule.label}`).not.toMatch(rule.pattern);
      }
    }
  });
});
