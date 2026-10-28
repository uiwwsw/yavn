# Contributing to YAVN

[한국어](CONTRIBUTING.md) · [Add a game](docs/ADDING_A_GAME.en.md) · [Creator guide](docs/DEVELOPMENT_GUIDE.en.md)

Contributions can add games, fix existing stories, improve the engine, translate copy or clarify documentation. Adding a game does not require changing React or engine code.

## Set up a contribution

Use Node.js 22.13+ and pnpm 11.21.0, pinned in `package.json`. Fork the repository first unless you have write access.

```bash
git clone https://github.com/<your-account>/yavn.git
cd yavn
git remote add upstream https://github.com/uiwwsw/yavn.git
git fetch upstream
git switch -c feat/my-contribution upstream/main
corepack enable
corepack prepare pnpm@11.21.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Collaborators with write access may clone the upstream repository and branch from `origin/main`. Open the URL printed by Vite (normally `http://localhost:5173`). Ordinary game development needs no production credentials. In a managed Developer workspace, follow its execution wrapper and storage rules; ordinary clones can run pnpm directly.

## Coordinate changes

- Describe the game/feature and affected files in an issue or draft PR. Discuss large features or asset additions before investing in them; small fixes need no prior issue.
- Keep each branch and PR focused. Separate game content from unrelated engine refactoring. Coordinate shared parser, schema, launcher and dependency changes and preserve other contributors' work.
- Fetch current main and resolve conflicts before review. Do not force overwrite shared branches. Resolve source YAML conflicts first, then regenerate `public/game-list/index.json` and `public/sitemap.xml` rather than hand-merging generated data.
- Keep games independent. Use common DSL and metadata instead of runtime branches for specific game IDs, characters or tags.
- Treat published folder names, choice keys and scene/action ordering as save-compatibility concerns. Explain migrations or limitations and test old saves when changing them.

## Verify and submit

```bash
pnpm test
pnpm build
python3 .github/scripts/check-public-docs.py --staged
python3 .github/scripts/check-ai-notice.py
python3 .github/scripts/check-ai-notice.py --built
```

Run the staged-content check after staging and review the exact diff. Add meaningful regression coverage for engine behavior. Update the Korean development reference, relevant READMEs and English guidance with behavior changes; update executable YAML examples when DSL usage changes. Game submissions also need the [manual play checks](docs/ADDING_A_GAME.en.md#4-play-checks).

Open a PR against `uiwwsw/yavn:main` and complete the template. Include motivation, commands and results, desktop/mobile screenshots for visual changes, save compatibility and known limitations. Mark checks you did not run. Respond to review on the same branch. Maintainers merge according to required checks and review and handle deployment; submission alone does not guarantee catalog publication.

## Rights and public content

Only submit material you may redistribute, and record asset sources and licenses as described in the game guide. Deployed YAML and assets are public. Keep credentials, personal records, caches, archives and editable source assets out of commits. Do not paste credentials or private records into public bug reports. Existing licenses and third-party rights continue to apply.
