# Add a game to the catalog

[Contributing](../CONTRIBUTING.en.md) · [한국어](ADDING_A_GAME.ko.md) · [Creator guide](DEVELOPMENT_GUIDE.en.md)

The catalog is generated from folders under `public/game-list/`. Uploading a ZIP to the website only runs it locally: it does not submit or publish a catalog entry. Publication requires a package PR, maintainer review, merge and deployment.

## 1. Copy the runnable starter

Set up the [development environment](../CONTRIBUTING.en.md), then run these commands from the repository root. Replace `my-story` with a unique lowercase ASCII ID using letters, numbers and hyphens. Do not copy over an existing directory.

```bash
cp -R examples/game-template public/game-list/my-story
pnpm dev
```

Open `/game-list/my-story/` at the Vite URL and play both choices to the ending. Search for the title on `/` as well. This starter contains an original Korean story, two choices and one ending, with no external assets. Its source under `examples/` stays out of the catalog until copied.

| File | Purpose |
| --- | --- |
| `config.yaml` | Title, author, version, start screen and endings |
| `base.yaml` | Shared assets, state and inventory |
| `launcher.yaml` | Catalog summary, tags and actual playable languages |
| `0.yaml` | First chapter script and scenes |
| `assets/` (optional) | Images, music and other runtime assets |

Replace the author/title/version and write your story. Start new packages at `0.yaml`, then add `1.yaml`, `2.yaml` and chapter transitions as needed. URL loading stops scanning sequential chapters at the first missing number, so keep numbering contiguous. See the DSL reference for nested chapter paths and base-layer inheritance. The root `sample.yaml` is a feature excerpt with references to a larger game; it is not a standalone starter.

Keep assets inside your package, use relative paths and match filename case exactly. Use `root:/` only for intentional shared public resources. Avoid depending on another game's files.

## 2. Describe the game

`launcher.yaml` describes catalog presentation separately from the engine DSL:

```yaml
languages: [ko]
summary: "편지 한 장에서 시작하는 짧은 선택형 이야기."
tags: [short-story, mystery]
translations:
  en:
    summary: "A Korean-language mystery that begins with a letter."
```

Add `thumbnail: assets/cover.jpg` only after adding that file. Without it, the catalog falls back to `config.yaml.startScreen.image`, then its default presentation. Optional `showcase` metadata controls the slide label, background and image framing. Only declare languages actually playable in the story; an English summary or English engine UI does not make the game bilingual.

Put `seo.description`, `seo.keywords`, `seo.image` and `seo.imageAlt` in `config.yaml` for search and sharing. JPEG/PNG social images can be separate from gameplay artwork. All referenced files must exist and be suitable for public distribution.

## 3. Generate and verify

```bash
node scripts/generate-game-list-manifest.mjs
pnpm check:public
pnpm test
pnpm build
```

`pnpm dev` and `pnpm build` also regenerate the catalog before starting. If you add a game while Vite is running, rerun the generator and refresh the catalog.

Include the generated changes to `public/game-list/index.json` and `public/sitemap.xml` in the PR; do not edit them manually. `generatedAt` changes on regeneration. Folders without chapter YAML are skipped. Chapter counts include nested YAML excluding files named config/base/launcher. Titles come primarily from `config.yaml.title`; games are sorted by title.

Generation does not validate every DSL reference or play every route. Invalid metadata YAML can produce warnings and fallback values, so inspect warnings and the actual catalog. The build generates search/share HTML for each `/game-list/<id>/`. Do not commit `dist/`, dependencies or caches.

## 4. Play checks

Record results and untested cases in the PR. Existing automated tests do not automatically exercise every new game's branches; add game-specific tests for conditional routes and new behavior.

- Check title, author, summary, tags, languages and thumbnail in both catalog locales, including search and filters.
- Open and refresh the direct `/game-list/<id>/` URL; check the start screen and first chapter.
- Play every choice, condition, chapter transition, ending/game-over and recovery path. Check missing assets and audio/Live2D loading where applicable.
- Check autosave, manual save, resume and new-game behavior. For updates, test previous saves and isolation from other games.
- Check desktop/mobile layouts, keyboard access, sound and motion settings.
- If distributing ZIP, put config/base/launcher, chapters and assets at the ZIP root, without an enclosing game folder. Test ZIP execution separately; this does not register a catalog entry.

## 5. Rights and submission

Record creators and usage terms for original work. For third-party assets, document source URLs, creators, licenses/permission and redistribution terms in `docs/games/<id>/ASSET_PROVENANCE.md` or an equivalent document. Keep editable sources, archives and unnecessary large files outside `public`. Everything in `public/game-list/**` is public, so exclude private notes and personal data.

Use `config.yaml.legalNotices` for credits/terms that players need to see. Each entry needs `id`, `title` and `text`; `copyright` and HTTP(S) `links` are optional. Notices do not grant permission. Do not assume another demo's characters, music or notices authorize reuse.

```bash
git add public/game-list/my-story public/game-list/index.json public/sitemap.xml
# Also stage the specific provenance documents and tests you added.
python3 .github/scripts/check-public-docs.py --staged
git diff --staged
```

Complete the remaining checks in CONTRIBUTING, push your feature branch to your fork or an authorized remote and open a PR against `uiwwsw/yavn:main`. Fill in the template with game ID, play path, actual languages, test results, rights evidence, desktop/mobile screenshots and limitations. Maintainers review, merge and deploy accepted submissions.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing from catalog | Folder location, chapter YAML, rerun generator and refresh |
| Wrong title/summary/languages | Config and launcher metadata, indentation and generation warnings |
| Card appears but game fails | First numbered chapter, config, parser errors and referenced state/assets/scenes |
| Images fail after deployment | Committed files, case-sensitive paths and cross-game dependencies |
| Generated JSON/XML conflict | Merge source YAML first, then regenerate |
| Local game absent from public site | PR merge and maintainer deployment status |
