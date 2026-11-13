/**
 * Writes <dist>/404.html, the page Vercel serves for any address that no longer exists.
 *
 * Retired games keep their own 301 redirects in vercel.json, so this page is the catch-all
 * for everything else: mistyped links, assets of a game that was taken down, and pages that
 * search engines still remember. It answers with a real 404 and offers the library, so a
 * visitor who arrives from a stale search result has somewhere to go.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://yavn.vercel.app';
const esc = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

async function readFontUrl(distDir) {
  try {
    const file = (await readdir(`${distDir}/assets`)).find((name) => /^SUITE-Variable.*\.woff2$/.test(name));
    return file ? `/assets/${file}` : '';
  } catch {
    return '';
  }
}

async function readPlayableGames(distDir) {
  try {
    const { games = [] } = JSON.parse(await readFile(`${distDir}/game-list/index.json`, 'utf8'));
    return games.filter((game) => game.path && game.name && game.id !== 'live2dtest');
  } catch {
    return [];
  }
}

export function renderNotFoundHtml({ games = [], fontUrl = '' } = {}) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>없는 쪽입니다 · 야븐 YAVN</title>
<meta name="robots" content="noindex,follow">
<meta name="theme-color" content="#183e36">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="없는 쪽입니다 · 야븐 YAVN">
<meta property="og:url" content="${ORIGIN}/">
<style>
${fontUrl ? `@font-face{font-family:'SUITE Variable';src:url(${fontUrl}) format('woff2');font-weight:100 900;font-display:swap}` : ''}
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px 16px;
  font:16px/1.7 'SUITE Variable',system-ui,-apple-system,sans-serif;color:#183e36;background:#faf8f1}
main{width:100%;max-width:560px}
p.code{margin:0 0 10px;font-size:13px;letter-spacing:.14em;color:#6d7f74}
h1{margin:0 0 12px;font-size:clamp(26px,6vw,34px);font-weight:800;line-height:1.3}
p.lead{margin:0 0 4px;font-size:17px}
p.sub{margin:0 0 28px;color:#52655b}
a.home{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:2px;
  background:#183e36;color:#faf8f1;font-weight:700;text-decoration:none}
a.home:hover{background:#0f2a25}
a.home:focus-visible{outline:2px solid #185c49;outline-offset:3px}
h2{margin:36px 0 12px;font-size:14px;font-weight:700;letter-spacing:.06em;color:#52655b}
ul{margin:0;padding:0;list-style:none;border-top:1px solid #dcd8c9}
li{border-bottom:1px solid #dcd8c9}
li a{display:block;padding:14px 2px;color:#183e36;text-decoration:none;font-weight:600}
li a:hover{color:#185c49}
li a:focus-visible{outline:2px solid #185c49;outline-offset:-2px}
li span{display:block;font-weight:400;font-size:14px;color:#52655b;margin-top:2px}
p.en{margin:30px 0 0;font-size:13px;color:#6d7f74}
p.en a{color:#185c49}
</style>
</head>
<body>
<main>
  <p class="code">404</p>
  <h1>없는 쪽입니다</h1>
  <p class="lead">주소가 바뀌었거나, 더 이상 올려 두지 않는 작품입니다.</p>
  <p class="sub">이야기 서재에서 지금 읽을 수 있는 작품을 골라 보세요.</p>
  <a class="home" href="/">이야기 서재로</a>
${games.length ? `  <h2>지금 읽을 수 있는 작품</h2>
  <ul>
${games.map((game) => `    <li><a href="${esc(game.path)}">${esc(game.name)}${game.summary ? `<span>${esc(game.summary)}</span>` : ''}</a></li>`).join('\n')}
  </ul>` : ''}
  <p class="en">This page no longer exists. <a href="/en/">Go to the library</a>.</p>
</main>
</body>
</html>
`;
}

export async function generateNotFoundPage({ distDir = 'dist' } = {}) {
  const [fontUrl, games] = await Promise.all([readFontUrl(distDir), readPlayableGames(distDir)]);
  const html = renderNotFoundHtml({ games, fontUrl });
  await writeFile(`${distDir}/404.html`, html);
  return { games: games.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { games } = await generateNotFoundPage({});
  console.log(`404.html written with ${games} game link(s)`);
}
