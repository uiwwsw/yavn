// Keep crawlable/no-JS content useful without exposing an unstyled text dump
// while the engine loads. The normal application CSS still owns the final UI.
//
// It borrows the launcher's paper, ink, accent and hairlines exactly, so the handover when
// the bundle takes over is a swap of layout, not of palette. The story list is set as ruled
// rows rather than a grid of identical rounded cards: the launcher has no such cards, and a
// shell that invents them reads as a different site for the second it is on screen.
export function styleStartupHtml(html, fontUrl) {
  const style = `<style id="startup-presentation">#root>.startup-preview{box-sizing:border-box;min-height:100svh;padding:clamp(24px,5.5vw,88px);background:#f7f5ee;color:#193c34;font-family:'SUITE Variable',system-ui,sans-serif;font-size:15px;line-height:1.7;word-break:keep-all;overflow-wrap:break-word}#root>.startup-preview>nav{display:flex;gap:16px;font-size:12px;letter-spacing:.06em;color:#69746c}#root>.startup-preview>h1{margin:22px 0 0;font-size:clamp(30px,4.4vw,52px);line-height:1.2;letter-spacing:-.045em;font-weight:750;max-width:18em}#root>.startup-preview>p{margin:18px 0 0;max-width:42em;line-height:1.8;color:#334b43}#root>.startup-preview h2{margin:48px 0 0;padding-bottom:14px;border-bottom:1px solid #d7dcd2;font-size:12px;font-weight:700;letter-spacing:.14em;color:#69746c}#root>.startup-preview ul{list-style:none;margin:0;padding:0}#root>.startup-preview li{padding:20px 0;border-bottom:1px solid #d7dcd2}#root>.startup-preview li a{font-size:19px;font-weight:700;letter-spacing:-.02em}#root>.startup-preview li p{margin:6px 0 0;max-width:46em}#root>.startup-preview li span{display:block;margin-top:8px;font-size:12px;color:#69746c}#root>.startup-preview a{color:inherit;text-decoration:none;text-underline-offset:4px}#root>.startup-preview a:hover{color:#ae492f}</style>`;
  return html.replace('<div id="root"><main>', '<div id="root"><main class="startup-preview">').replace('</head>', `${fontUrl ? `<link rel="preload" href="${fontUrl}" as="font" type="font/woff2" crossorigin="anonymous">` : ''}${style}</head>`);
}
