import { readdir } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const publicDir = path.join(workspaceRoot, 'public');

const REQUIRED_ROOT_FILES = ['favicon.svg', 'robots.txt', 'sitemap.xml'];
const ALLOWED_ROOT_FILES = new Set(REQUIRED_ROOT_FILES);
const ALLOWED_PREFIXES = ['game-list/'];

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
