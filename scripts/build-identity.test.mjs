import { describe, expect, it } from 'vitest';
import { renderVersionManifest, resolveBuildIdentity, resolveCommit, yavnBuildIdentity } from './build-identity.mjs';

describe('build identity', () => {
  it('prefers the Vercel commit, then git, then dev', () => {
    expect(resolveCommit({ VERCEL_GIT_COMMIT_SHA: '0123456789abcdef' }, () => 'ffffff1')).toBe('0123456');
    expect(resolveCommit({}, () => 'abc1234\n')).toBe('abc1234');
    expect(resolveCommit({}, () => { throw new Error('no git'); })).toBe('dev');
    expect(resolveCommit({}, () => 'fatal: not a git repository')).toBe('dev');
  });

  it('uses the package version and build time', () => {
    const identity = resolveBuildIdentity({ env: {}, runGit: () => 'abc1234', now: new Date('2026-11-13T00:00:00.000Z') });
    expect(identity).toEqual({ build: '0.2.0', commit: 'abc1234', builtAt: '2026-11-13T00:00:00.000Z' });
  });

  it('defines the client constant and emits version.json into the build', () => {
    const identity = { build: '0.2.0', commit: 'abc1234', builtAt: '2026-11-13T00:00:00.000Z' };
    const plugin = yavnBuildIdentity(identity);
    expect(plugin.config().define.__YAVN_BUILD__).toBe(JSON.stringify(identity));
    const emitted = [];
    plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) });
    expect(emitted).toEqual([{ type: 'asset', fileName: 'version.json', source: renderVersionManifest(identity) }]);
    expect(JSON.parse(emitted[0].source)).toEqual(identity);
  });
});
