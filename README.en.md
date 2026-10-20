# YAVN — Visual Novel and Story RPG Game Maker

[한국어](README.md) · [Play demos](https://yavn.vercel.app/en/) · [Creator guide](docs/DEVELOPMENT_GUIDE.en.md)

Make choice-driven browser games with YAML scenes, dialogue, branching choices, state and inventory. Add characters, music, video and Live2D, then package your game as ZIP and play it in the browser. YAVN is a narrative engine, not a 3D combat or tile-map editor.

## Features

- YAML V3 with separate global config, shared assets and chapters.
- Visual novel presentation, character direction, music and cinematic effects.
- Story RPG progression through choices, state and inventory.
- Chapter story maps, discovered paths and replay checkpoints.
- Local autosave, manual saves and portable save backups.
- Korean and English launcher/engine controls; catalog language labels, search and filters.
- Browser demos with per-game public search pages and language metadata.

## Development

Use Node 22.13+ and pinned pnpm. Run `pnpm install`, `pnpm dev`, `pnpm test`, then `pnpm build`. Follow the workspace SSD rules when applicable.

Start with [sample.yaml](sample.yaml) and complete game packages in `public/game-list/`. See the English guide for packaging and language declarations, and the [Korean reference](docs/DEVELOPMENT_GUIDE.ko.md) for the detailed DSL. Interface language does not translate creator-authored story content. Only declare languages actually available in a game.
