import { styleStartupHtml } from './startup-presentation.mjs';
import { renderCreatePage } from './create-page.mjs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
const origin = 'https://yavn.vercel.app';
const esc = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const template = await readFile('dist/index.html','utf8');
const fontUrl = '/assets/' + (await readdir('dist/assets')).find(f=>/^SUITE-Variable.*\.woff2$/.test(f));
const {games} = JSON.parse(await readFile('dist/game-list/index.json','utf8'));
for (const en of [false,true]) {
 const lang=en?'en':'ko', base=en?'/en/':'/';
 const title=en?'YAVN — Visual Novel & Story RPG Game Maker':'야븐 YAVN — 비주얼노벨·스토리 RPG 게임 만들기';
 const description=en?'Make browser visual novels and choice-driven story RPGs with YAML scenes, branching dialogue, inventory and Live2D. Play web game demos and read the creator guide.':'야븐으로 비주얼노벨·선택형 스토리 RPG 웹게임을 만들어 보세요. YAML 장면·대사·분기·아이템·Live2D로 게임 만들기부터 브라우저 데모 플레이까지 지원합니다.';
 const head=(pageTitle,desc,path,ko,enPath)=>`<!-- yavn:seo:start -->
<meta name="theme-color" content="#183e36"><title>${esc(pageTitle)}</title><meta name="description" content="${esc(desc)}"><meta name="keywords" content="야븐, YAVN, RPG 만들기, 게임 만들기, 웹게임 만들기, 비주얼노벨 만들기, RPG game maker, web game maker, visual novel engine, make a game, browser games, YAML game engine"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${origin}${path}"><link rel="alternate" hreflang="ko" href="${origin}${ko}"><link rel="alternate" hreflang="en" href="${origin}${enPath}"><link rel="alternate" hreflang="x-default" href="${origin}${enPath}"><meta property="og:type" content="website"><meta property="og:site_name" content="YAVN"><meta property="og:locale" content="${en?'en_US':'ko_KR'}"><meta property="og:title" content="${esc(pageTitle)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${origin}${path}"><meta property="og:image" content="${origin}/favicon.svg"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(pageTitle)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${origin}/favicon.svg"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'SoftwareApplication',name:'YAVN',alternateName:['야븐','야븐엔진'],description:desc,applicationCategory:'GameApplication',operatingSystem:'Web',url:origin+path,inLanguage:lang,isAccessibleForFree:true,sameAs:'https://github.com/uiwwsw/yavn'}).replaceAll('<','\\u003c')}</script><!-- yavn:seo:end -->`;
 const gameList=`<h2>${en?'Playable web game demos':'야븐 웹게임 데모'}</h2><ul>${games.map(g=>`<li><a href="${esc(g.path)}">${esc(g.name)}</a><p>${esc((en?g.summaryEn??g.summary:g.summary)??'')}</p><span>${en?'Game language':'지원 언어'}: ${esc((g.languages??[]).map(l=>l==='ko'?'한국어 · Korean':l).join(', ')|| (en?'Not specified':'미등록'))}</span></li>`).join('')}</ul>`;
 const content=`<main><nav><a href="/">한국어</a> · <a href="/en/">English</a></nav><h1>${esc(title)}</h1><p>${esc(description)}</p>${gameList}<a href="${base}create/">${en?'Make a web game or story RPG':'웹게임·스토리 RPG 만들기'}</a><a href="https://github.com/uiwwsw/yavn">GitHub</a></main>`;
 const html=template.replace('<html lang="ko">',`<html lang="${lang}">`).replace(/<!-- yavn:seo:start -->[\s\S]*?<!-- yavn:seo:end -->/,head(title,description,base,'/','/en/')).replace('<div id="root"></div>',`<div id="root">${content}</div>`);
 const dir=en?'dist/en':'dist';await mkdir(dir,{recursive:true});await writeFile(`${dir}/index.html`,styleStartupHtml(html, fontUrl));
 const guideTitle=en?'How to Make a Web Game or Story RPG with YAVN':'야븐으로 웹게임·스토리 RPG 만들기';
 const guideDescription=en?'Step-by-step YAVN creator guide: write YAML scenes and dialogue, add choices, inventory and Live2D, package a ZIP, and test branches, endings and saves.':'야븐 제작 가이드: YAML 장면·대사와 선택지 작성, 상태·인벤토리·Live2D 추가, ZIP 패키징부터 분기·결말·저장 테스트까지 단계별로 안내합니다.';
 const guidePath=`${base}create/`;await mkdir(`dist${guidePath}`,{recursive:true});
 await writeFile(`dist${guidePath}index.html`,renderCreatePage({lang,head:head(guideTitle,guideDescription,guidePath,'/create/','/en/create/'),fontUrl}));
}
