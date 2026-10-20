# SEO and language behavior

Public site: https://yavn.vercel.app. Canonical Korean and English home/creation pages are `/`, `/en/`, `/create/`, `/en/create/`. Each game has its own canonical route and readable initial HTML. Launcher language metadata supplies VideoGame.inLanguage rather than a hardcoded Korean claim. Unknown language is omitted. Uploaded games and local saves are never added to the sitemap.

Search intent includes 야븐, 게임 만들기, 웹게임 만들기, 비주얼노벨 만들기, 스토리 RPG 만들기, YAVN, visual novel maker, web game maker and story RPG game maker. Visible guides explain actual engine scope, without unsupported battle/map editing claims. Real translated pages and reciprocal hreflang accompany keyword metadata.

Build: pnpm build. Tests: pnpm test. Verify public pages, catalog languages/search, game startup, desktop/mobile overflow and sitemap after release. Indexing/ranking remains a search-engine decision.

## 2026-10-20 production verification

Published Korean and English pages, sitemap and Google verification file return HTTP 200. Google Search Console ownership verification and sitemap submission completed. Naver ownership verification and sitemap submission completed (2026-10-20 13:54:52 KST). Site-specific submission status must not be described as indexing completion.

Runtime source baseline: 29bb875. GitHub description, homepage and relevant repository topics were updated.
The sitemap has 8 public URLs (4 home/creation pages + 4 games); nonexistent game URLs return HTTP 404. All 403 tests passed. New catalog games automatically generate their own HTML, canonical, image, description and real story-language declarations at build/deployment time.
