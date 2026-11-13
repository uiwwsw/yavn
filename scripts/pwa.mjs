import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

/**
 * Installable PWA for the YAVN site, without plugin dependencies:
 * - `manifest.webmanifest` and PNG icons rasterized here from the favicon mark,
 * - `sw.js` bundled from `src/pwa/sw.ts` with this build's precache list and version,
 * - `game-list/<id>/offline.json`: every file of a game, for "오프라인 저장".
 * Everything is written into the build output; nothing is added to `public/`.
 */

export const THEME_COLOR = '#183e36';
export const BACKGROUND_COLOR = '#f7f5ee';
/** Games larger than this are not offered for offline saving (live2dtest is ~47MB). */
export const OFFLINE_MAX_BYTES = 20 * 1024 * 1024;
export const NAVIGATION_TIMEOUT_MS = 3500;

export const ICONS = [
  { fileName: 'icons/icon-192.png', size: 192, variant: 'any' },
  { fileName: 'icons/icon-512.png', size: 512, variant: 'any' },
  { fileName: 'icons/icon-maskable-512.png', size: 512, variant: 'maskable' },
  { fileName: 'icons/apple-touch-icon.png', size: 180, variant: 'apple' },
];

// ---------------------------------------------------------------- icons

// The favicon mark (public/favicon.svg) in its 64-unit space: an open book and a spark.
const MARK = [
  { color: [0xf6, 0xf3, 0xeb], points: [[12, 15], [29, 24], [29, 51], [12, 42]] },
  { color: [0xf6, 0xf3, 0xeb], points: [[35, 24], [52, 15], [52, 42], [35, 51]] },
  { color: [0xec, 0x87, 0x69], points: [[32, 7], [37, 12], [32, 17], [27, 12]] },
];
const BACKGROUND = [0x18, 0x3e, 0x36];

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insideRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 64 - radius);
  const cy = Math.min(Math.max(y, radius), 64 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 && x >= 0 && y >= 0 && x <= 64 && y <= 64;
}

/**
 * RGBA pixels of the app icon. `any` keeps the favicon's rounded square; `maskable`
 * and `apple` fill the square (the platform rounds it) and shrink the mark into the safe zone.
 */
export function rasterizeIcon(size, variant = 'any') {
  const scale = variant === 'maskable' ? 0.74 : variant === 'apple' ? 0.86 : 1;
  const rounded = variant === 'any';
  const samples = 4;
  const pixels = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = ((px + (sx + 0.5) / samples) / size) * 64;
          const y = ((py + (sy + 0.5) / samples) / size) * 64;
          if (rounded && !insideRoundedSquare(x, y, 15)) continue;
          const mx = 32 + (x - 32) / scale;
          const my = scale === 1 ? y : 29 + (y - 32) / scale;
          let color = BACKGROUND;
          for (const shape of MARK) if (insidePolygon(mx, my, shape.points)) color = shape.color;
          r += color[0]; g += color[1]; b += color[2]; a += 1;
        }
      }
      const offset = (py * size + px) * 4;
      if (a > 0) {
        pixels[offset] = Math.round(r / a);
        pixels[offset + 1] = Math.round(g / a);
        pixels[offset + 2] = Math.round(b / a);
      }
      pixels[offset + 3] = Math.round((a / (samples * samples)) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Minimal PNG encoder: 8-bit RGBA, no filtering, zlib from Node. */
export function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function renderIcons() {
  return ICONS.map((icon) => ({ ...icon, source: encodePng(icon.size, icon.size, rasterizeIcon(icon.size, icon.variant)) }));
}

// ---------------------------------------------------------------- manifest

export function renderWebManifest() {
  const manifest = {
    id: '/',
    name: '야븐 YAVN',
    short_name: '야븐',
    description: '선택으로 완성하는 비주얼 노벨. 저장한 게임은 오프라인에서도 플레이할 수 있어요.',
    lang: 'ko',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

// ---------------------------------------------------------------- offline packs

function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile() && relative !== 'offline.json' && relative !== 'index.html') files.push(relative);
  }
  return files.sort();
}

function shortHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function readListedVersions(gameListDir) {
  try {
    const manifest = JSON.parse(readFileSync(path.join(gameListDir, 'index.json'), 'utf8'));
    return new Map((manifest.games ?? []).map((game) => [game.id, typeof game.version === 'string' ? game.version : undefined]));
  } catch {
    return new Map();
  }
}

/**
 * One pack per game folder: paths relative to the game folder, sizes and hashes.
 * `hash` changes whenever any file changes, which is how the launcher notices a
 * saved game is out of date.
 */
export function collectOfflinePacks(publicDir, { maxBytes = OFFLINE_MAX_BYTES } = {}) {
  const gameListDir = path.join(publicDir, 'game-list');
  if (!existsSync(gameListDir)) return [];
  const versions = readListedVersions(gameListDir);
  const packs = [];
  for (const entry of readdirSync(gameListDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const gameDir = path.join(gameListDir, entry.name);
    if (!existsSync(path.join(gameDir, 'config.yaml'))) continue;
    const files = listFiles(gameDir).map((file) => {
      const absolute = path.join(gameDir, file);
      return { path: file, bytes: statSync(absolute).size, hash: shortHash(readFileSync(absolute)) };
    });
    const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
    packs.push({
      schemaVersion: 1,
      id: entry.name,
      version: versions.get(entry.name),
      hash: shortHash(files.map((file) => `${file.path}:${file.hash}`).join('\n')),
      bytes,
      offerable: bytes <= maxBytes,
      files,
    });
  }
  return packs.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------- service worker

const PRECACHE_EXTENSIONS = /\.(?:js|css|woff2?|wav|flac|mp3|ogg|svg|png|webp|jpe?g)$/i;
// Only live2dtest needs the Live2D runtime; it is cached when a Live2D game first loads it.
const PRECACHE_EXCLUDE = /live2d|cubism/i;

/** URLs a cold offline start needs: the shell, every app chunk except Live2D, icons. */
export function collectPrecache(bundleFileNames, extra = []) {
  const assets = bundleFileNames
    .filter((name) => name.startsWith('assets/') && PRECACHE_EXTENSIONS.test(name) && !PRECACHE_EXCLUDE.test(name))
    .map((name) => `/${name}`)
    .sort();
  return [...new Set(['/', ...assets, '/favicon.svg', '/manifest.webmanifest', ...ICONS.map((icon) => `/${icon.fileName}`), ...extra])];
}

/** The commit is the cache version; a local 'dev' build adds a hash of its file list. */
export function resolveCacheVersion(identity, precache) {
  const base = `${identity.build}-${identity.commit}`;
  return identity.commit === 'dev' ? `${base}-${shortHash(precache.join('\n')).slice(0, 8)}` : base;
}

export function buildServiceWorkerConfig({ identity, bundleFileNames, packs }) {
  const precache = collectPrecache(bundleFileNames);
  const optional = ['/en/', ...packs.filter((pack) => pack.offerable).map((pack) => `/game-list/${pack.id}/`)];
  return { version: resolveCacheVersion(identity, precache), precache, optional, navigationTimeoutMs: NAVIGATION_TIMEOUT_MS };
}

/** Bundles `src/pwa/sw.ts` (and the routing module it imports) into one classic script. */
export async function renderServiceWorker(root, config) {
  const { build } = await import('vite');
  const result = await build({
    configFile: false,
    root,
    logLevel: 'warn',
    publicDir: false,
    define: { __YAVN_SW_CONFIG__: JSON.stringify(config) },
    build: {
      write: false,
      emptyOutDir: false,
      minify: true,
      target: 'es2020',
      lib: { entry: path.join(root, 'src/pwa/sw.ts'), formats: ['iife'], name: 'yavnServiceWorker', fileName: () => 'sw.js' },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => output.output).find((item) => item.type === 'chunk');
  if (!chunk) throw new Error('Service worker bundle produced no code.');
  return `/* YAVN service worker · cache ${config.version} */\n${chunk.code}`;
}

// ---------------------------------------------------------------- vite plugin

export function yavnPwa({ identity, root = process.cwd(), renderWorker = renderServiceWorker, maxOfflineBytes = OFFLINE_MAX_BYTES } = {}) {
  let publicDir = path.join(root, 'public');
  const manifest = renderWebManifest();
  let icons;
  const getIcons = () => (icons ??= renderIcons());
  return {
    name: 'yavn-pwa',
    configResolved(config) {
      if (config.publicDir) publicDir = config.publicDir;
    },
    configureServer(server) {
      // Dev serves the manifest and icons so the links in index.html resolve. No worker in dev.
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split('?')[0];
        if (url === '/manifest.webmanifest') {
          response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          response.end(manifest);
          return;
        }
        const icon = getIcons().find((item) => `/${item.fileName}` === url);
        if (!icon) return next();
        response.setHeader('Content-Type', 'image/png');
        response.end(icon.source);
      });
    },
    async generateBundle(_options, bundle) {
      const packs = collectOfflinePacks(publicDir, { maxBytes: maxOfflineBytes });
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest });
      for (const icon of getIcons()) this.emitFile({ type: 'asset', fileName: icon.fileName, source: icon.source });
      for (const pack of packs) {
        this.emitFile({ type: 'asset', fileName: `game-list/${pack.id}/offline.json`, source: `${JSON.stringify(pack)}\n` });
      }
      const config = buildServiceWorkerConfig({ identity, bundleFileNames: Object.keys(bundle), packs });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: await renderWorker(root, config) });
    },
  };
}
