import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const publicDir = path.join(workspaceRoot, 'public');

const REQUIRED_ROOT_FILES = ['favicon.svg', 'robots.txt', 'sitemap.xml'];
const ALLOWED_ROOT_FILES = new Set([...REQUIRED_ROOT_FILES, 'googlef965631a155f9226.html', 'usage-analytics.js', 'usage-analytics.css']);
const ALLOWED_PREFIXES = ['game-list/'];

// Every retained Vercel deployment keeps its own copy of public/, so weight here is
// paid once per deploy. These never belong in a deployment, wherever they sit.
const NEVER_SHIPPED = [
  {
    test: (value) => /\.(?:cmo3|can3|psd|clip|xcf|blend|ai|sketch|fig)$/i.test(value),
    hint: 'Editor source files belong outside public (for example: assets/live2d-source/...).',
  },
  {
    test: (value) => /\/assets\/music\/[^/]+\.wav$/i.test(value),
    hint: 'Music must ship as FLAC — run `node scripts/compress-music.mjs`.',
  },
];

// Nothing a player downloads should be this heavy. The cap exists so a stray editor
// source or an uncompressed render cannot quietly multiply across deployments.
const MAX_FILE_BYTES = 6 * 1024 * 1024;

const DISALLOWED_HINTS = [
  {
    test: (value) => /\.zip$/i.test(value),
    hint: 'ZIP assets should live outside public (for example: assets/archive/...).',
  },
  {
    test: (value) => /\.md$/i.test(value),
    hint: 'Markdown/docs should live outside public.',
  },
  {
    test: (value) => /\.(txt|text)$/i.test(value),
    hint: 'License/readme text files should live outside public.',
  },
  {
    test: (value) => /(^|\/)\.DS_Store$/.test(value),
    hint: 'Remove macOS metadata files from public.',
  },
];

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

async function collectFiles(dirPath, prefix = '') {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path.join(dirPath, entry.name), rel)));
      continue;
    }
    if (entry.isFile()) {
      files.push(toPosixPath(rel));
    }
  }
  return files;
}

function isAllowedPublicFile(relPath) {
  if (ALLOWED_ROOT_FILES.has(relPath)) {
    return true;
  }
  return ALLOWED_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

const files = await collectFiles(publicDir);
const violations = [];

for (const relPath of files) {
  const neverShipped = NEVER_SHIPPED.find((rule) => rule.test(relPath));
  if (neverShipped) {
    violations.push(`- ${relPath}: ${neverShipped.hint}`);
    continue;
  }

  const { size } = await stat(path.join(publicDir, relPath));
  if (size > MAX_FILE_BYTES) {
    const mb = (size / 1024 / 1024).toFixed(1);
    violations.push(`- ${relPath}: ${mb} MB exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB public file cap.`);
    continue;
  }

  if (isAllowedPublicFile(relPath)) {
    continue;
  }

  const matchedHint = DISALLOWED_HINTS.find((rule) => rule.test(relPath));
  if (matchedHint) {
    violations.push(`- ${relPath}: ${matchedHint.hint}`);
    continue;
  }

  violations.push(`- ${relPath}: not in public allowlist (allowed: favicon.svg, robots.txt, sitemap.xml, game-list/**)`);
}

for (const required of REQUIRED_ROOT_FILES) {
  if (!files.includes(required)) {
    violations.push(`- ${required}: required public file is missing`);
  }
}

if (violations.length > 0) {
  console.error('[public-allowlist] Validation failed.');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log(`[public-allowlist] OK (${files.length} files)`);
