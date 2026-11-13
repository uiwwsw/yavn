import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Build identity shared by the client bundle (`__YAVN_BUILD__`) and `/version.json`.
 * The running page compares its own identity with the deployed `version.json` to
 * notice a new deployment without reloading on its own.
 */

/** Short commit for this build: Vercel's SHA, then local git, then 'dev'. */
export function resolveCommit(env = process.env, runGit = defaultRunGit) {
  const fromVercel = typeof env.VERCEL_GIT_COMMIT_SHA === 'string' ? env.VERCEL_GIT_COMMIT_SHA.trim() : '';
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    const fromGit = String(runGit() ?? '').trim();
    if (/^[0-9a-f]{4,40}$/i.test(fromGit)) return fromGit.slice(0, 7);
  } catch {
    // No git checkout (for example, a source tarball). Fall through.
  }
  return 'dev';
}

function defaultRunGit() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

export function readPackageVersion(root = process.cwd()) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** `{ build, commit, builtAt }` — the same shape is injected into the bundle and served as version.json. */
export function resolveBuildIdentity({ root = process.cwd(), env = process.env, runGit, now = new Date() } = {}) {
  return {
    build: readPackageVersion(root),
    commit: resolveCommit(env, runGit),
    builtAt: now.toISOString(),
  };
}

export function renderVersionManifest(identity) {
  return `${JSON.stringify({ build: identity.build, commit: identity.commit, builtAt: identity.builtAt }, null, 2)}\n`;
}

/** Vite plugin: define `__YAVN_BUILD__`, emit `version.json` on build and serve it in dev. */
export function yavnBuildIdentity(identity = resolveBuildIdentity()) {
  const manifest = renderVersionManifest(identity);
  return {
    name: 'yavn-build-identity',
    config() {
      return { define: { __YAVN_BUILD__: JSON.stringify(identity) } };
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/version.json') return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(manifest);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: manifest });
    },
  };
}
