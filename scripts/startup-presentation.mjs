// Keep crawlable/no-JS content useful without exposing an unstyled text dump
// while the engine loads. The normal application CSS still owns the final UI.
export function styleStartupHtml(html, fontUrl) {
  const style = `<style id="startup-presentation">#root>.startup-preview{box-sizing:border-box;min-height:100svh;padding:clamp(24px,6vw,72px);background:#f5f3eb;color:#183e36;font-family:'SUITE Variable',system-ui,sans-serif;line-height:1.7}#root>.startup-preview>h1{font-size:clamp(28px,4vw,48px);line-height:1.3;max-width:900px}#root>.startup-preview>p{max-width:850px}#root>.startup-preview ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:18px}#root>.startup-preview li{padding:24px;border:1px solid #d9dfd3;border-radius:12px;background:#fffdf6}#root>.startup-preview a{color:inherit;text-underline-offset:4px}#root>.startup-preview nav{display:flex;gap:16px}</style>`;
  return html.replace('<div id="root"><main>', '<div id="root"><main class="startup-preview">').replace('</head>', `${fontUrl ? `<link rel="preload" href="${fontUrl}" as="font" type="font/woff2" crossorigin="anonymous">` : ''}${style}</head>`);
}
