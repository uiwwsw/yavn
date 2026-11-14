/**
 * The creator guide at /create/ and /en/create/.
 *
 * It is a static page — no React, no app bundle — because a crawler and a first-time visitor
 * should get the whole thing from the first response. That is why the markup and the styles
 * live here as strings rather than as a component.
 *
 * It borrows the launcher's own palette, gutter and rules instead of inventing a second look:
 * paper #f7f5ee, ink #193c34, one rust accent, hairlines, no cards and no shadows. The five
 * steps really are a sequence, so they are numbered; nothing else is.
 */

const esc = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const COPY = {
  ko: {
    home: '/',
    other: { href: '/en/create/', label: 'English' },
    eyebrow: '만들기 가이드',
    title: '야븐으로 웹게임·스토리 RPG 만들기',
    lede: 'YAML로 장면·대사·선택지를 작성해 비주얼노벨과 선택형 스토리 RPG 웹게임을 만드세요. 분기, 상태, 아이템, 음악, Live2D를 지원합니다.',
    boundaryLabel: '야븐이 아닌 것',
    boundary: '타일맵이나 3D 전투 편집기는 아닙니다.',
    stepsLabel: '다섯 단계',
    steps: [
      '저장소의 샘플 YAML로 시작합니다.',
      '장면과 대사·선택지를 작성하고 공통 자산과 챕터를 YAML V3로 나눕니다.',
      '상태·인벤토리로 진행 조건을 만들고 사용 권한이 있는 이미지·음악을 추가합니다.',
      'ZIP으로 묶어 데모의 ‘내 게임 열기’에서 실행합니다.',
      '모든 분기·결말·저장 기능을 테스트한 뒤 웹게임으로 공개합니다.',
    ],
    languageHeading: '화면 언어와 작품 언어',
    languageBody:
      '목록과 엔진 조작 UI는 한·영으로 제공하며 작품의 실제 대사 언어는 게임별로 표시합니다. 화면 언어를 바꿔도 작품을 자동 번역하지 않습니다.',
    actionsLabel: '이어서',
    guideLink: '제작 가이드 전문',
    sampleLink: '샘플 YAML',
    browse: '이야기 둘러보기',
    footer: '야븐 YAVN — 선택으로 완성하는 이야기',
  },
  en: {
    home: '/en/',
    other: { href: '/create/', label: '한국어' },
    eyebrow: 'CREATOR GUIDE',
    title: 'How to Make a Web Game or Story RPG with YAVN',
    lede: 'Build a choice-driven narrative game, visual novel or story RPG using YAML. YAVN provides scenes, dialogue, branches, state, inventory, sound and Live2D.',
    boundaryLabel: 'What YAVN is not',
    boundary: 'It is not a tile-map or 3D combat engine.',
    stepsLabel: 'Five steps',
    steps: [
      'Copy the sample YAML from the repository.',
      'Write scenes, dialogue and choices; split common assets and chapters in YAML V3.',
      'Add state and inventory for story RPG progression. Add licensed images, music or Live2D assets.',
      'Package your files as ZIP and choose “Open my game” in the demo.',
      'Test all branches, endings and saves before publishing your web game.',
    ],
    languageHeading: 'Demo language vs interface language',
    languageBody:
      'The launcher and engine controls support English and Korean. Each demo lists its own story languages. Changing the interface does not translate a creator’s story.',
    actionsLabel: 'Next',
    guideLink: 'Full creator guide',
    sampleLink: 'Sample YAML',
    browse: 'Browse stories',
    footer: 'YAVN — stories you finish by choosing',
  },
};

const LOGO = `<svg class="mark" viewBox="0 0 180 42" fill="currentColor" aria-hidden="true" focusable="false"><path d="M3 5 18 13v24L3 29V5Zm19 8L37 5v24l-15 8V13Z"/><path class="spark" d="m20 0 4 4-4 4-4-4 4-4Z"/><path d="m51 9 8 13 8-13h8L63 29v8h-8v-8L43 9h8Z"/><path fill-rule="evenodd" d="m86 9 12 28h-8l-2-5H77l-2 5h-8L79 9h7Zm-3.5 8-3.5 9h7l-3.5-9Z"/><path d="m103 9 8 19 8-19h8l-12 28h-8L95 9h8Zm27 0h7l16 17V9h8v28h-7l-16-17v17h-8V9Z"/><circle class="spark" cx="172" cy="33" r="4"/></svg>`;

function styles(fontUrl) {
  return `${fontUrl ? `@font-face{font-family:'SUITE Variable';src:url(${fontUrl}) format('woff2');font-weight:100 900;font-display:swap}` : ''}
:root{color-scheme:light;--ink:#193c34;--paper:#f7f5ee;--muted:#69746c;--line:#d7dcd2;--accent:#ae492f;--gutter:clamp(20px,5.5vw,88px)}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 'SUITE Variable',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:break-word}
a{color:inherit;text-decoration:none}
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:5px}
.wrap{width:min(1600px,100%);margin:0 auto;padding-inline:var(--gutter)}
.mark{display:block;width:134px;height:31px}
.spark{fill:#bd5c3f}

.topbar{min-height:96px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding-block:24px;border-bottom:1px solid var(--line)}
.topbar nav{display:flex;align-items:center;gap:26px;font-size:13px;font-weight:700}
.topbar nav a{min-height:44px;display:inline-flex;align-items:center}
.topbar nav a:hover{color:var(--accent)}

.eyebrow{display:flex;align-items:center;gap:12px;margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--muted)}
.eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent)}

.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:48px 80px;padding-block:clamp(48px,7vw,96px) clamp(36px,5vw,64px)}
h1{margin:18px 0 0;font-size:clamp(32px,4.4vw,58px);line-height:1.18;letter-spacing:-.045em;font-weight:750;word-break:keep-all}
.lede{margin:24px 0 0;max-width:34em;font-size:clamp(16px,1.3vw,19px);line-height:1.8;color:#334b43}
.boundary{align-self:end;padding-left:18px;border-left:2px solid var(--accent)}
.boundary dt{font-size:12px;font-weight:700;letter-spacing:.1em;color:var(--muted)}
.boundary dd{margin:8px 0 0;font-size:17px;line-height:1.7}

section{padding-block:clamp(36px,5vw,64px);border-top:1px solid var(--line)}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:24px;margin-bottom:8px}
h2{margin:0;font-size:clamp(22px,2.2vw,30px);line-height:1.35;letter-spacing:-.03em;font-weight:750;word-break:keep-all}
.count{flex:0 0 auto;font-size:12px;letter-spacing:.06em;color:var(--muted);font-variant-numeric:tabular-nums}

ol{margin:28px 0 0;padding:0;list-style:none;counter-reset:step}
ol li{counter-increment:step;display:grid;grid-template-columns:72px minmax(0,1fr);gap:24px;align-items:baseline;padding:22px 0;border-bottom:1px solid var(--line)}
ol li:first-child{border-top:1px solid var(--line)}
ol li::before{content:counter(step,decimal-leading-zero);font-size:13px;font-weight:700;letter-spacing:.1em;color:var(--accent);font-variant-numeric:tabular-nums}
ol li span{font-size:clamp(16px,1.25vw,18px);line-height:1.75;max-width:46em;word-break:keep-all}

.note{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:24px 80px;align-items:start}
.note p{margin:0;max-width:44em;line-height:1.85;color:#334b43}

.actions{display:flex;flex-wrap:wrap;gap:14px 28px;margin-top:28px}
.actions a{min-height:48px;display:inline-flex;align-items:center;font-weight:700;border-bottom:1px solid var(--line);padding-bottom:2px}
.actions a:hover{color:var(--accent);border-bottom-color:var(--accent)}
.actions a.primary{padding-inline:26px;border:0;border-radius:2px;background:var(--ink);color:var(--paper)}
.actions a.primary:hover{background:#0f2a25;color:var(--paper)}

footer{padding-block:32px 40px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;font-size:12px;color:var(--muted)}
footer a:hover{color:var(--accent)}

@media (max-width:860px){
 .hero{grid-template-columns:1fr;gap:36px}
 .boundary{align-self:start}
 .note{grid-template-columns:1fr;gap:16px}
 ol li{grid-template-columns:44px minmax(0,1fr);gap:16px;padding:18px 0}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`;
}

export function renderCreatePage({ lang = 'ko', head = '', fontUrl = '' } = {}) {
  const copy = COPY[lang] ?? COPY.ko;
  const total = String(copy.steps.length).padStart(2, '0');
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${head}
<style>${styles(fontUrl)}</style>
</head>
<body>
<header class="wrap topbar">
  <a href="${esc(copy.home)}" aria-label="YAVN">${LOGO}</a>
  <nav>
    <a href="${esc(copy.home)}">${esc(copy.browse)}</a>
    <a href="${esc(copy.other.href)}" lang="${lang === 'ko' ? 'en' : 'ko'}">${esc(copy.other.label)}</a>
  </nav>
</header>
<main class="wrap">
  <div class="hero">
    <div>
      <p class="eyebrow">${esc(copy.eyebrow)}</p>
      <h1>${esc(copy.title)}</h1>
      <p class="lede">${esc(copy.lede)}</p>
    </div>
    <dl class="boundary">
      <dt>${esc(copy.boundaryLabel)}</dt>
      <dd>${esc(copy.boundary)}</dd>
    </dl>
  </div>
  <section>
    <div class="section-head">
      <h2>${esc(copy.stepsLabel)}</h2>
      <span class="count">01 — ${total}</span>
    </div>
    <ol>
${copy.steps.map((step) => `      <li><span>${esc(step)}</span></li>`).join('\n')}
    </ol>
  </section>
  <section>
    <div class="note">
      <h2>${esc(copy.languageHeading)}</h2>
      <p>${esc(copy.languageBody)}</p>
    </div>
  </section>
  <section>
    <div class="section-head"><h2>${esc(copy.actionsLabel)}</h2></div>
    <div class="actions">
      <a class="primary" href="${esc(copy.home)}">${esc(copy.browse)}</a>
      <a href="https://github.com/uiwwsw/yavn/blob/main/docs/DEVELOPMENT_GUIDE.${esc(lang)}.md">${esc(copy.guideLink)}</a>
      <a href="https://github.com/uiwwsw/yavn/blob/main/sample.yaml">${esc(copy.sampleLink)}</a>
    </div>
  </section>
</main>
<footer class="wrap">
  <span>${esc(copy.footer)}</span>
  <a href="https://github.com/uiwwsw/yavn">GitHub</a>
</footer>
</body>
</html>
`;
}
