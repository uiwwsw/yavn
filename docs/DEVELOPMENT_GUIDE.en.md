# YAVN creator guide

## Contribute or submit a game

Follow [CONTRIBUTING](../CONTRIBUTING.en.md) for setup, coordination and review, and [Add a game](ADDING_A_GAME.en.md) for the runnable `examples/game-template/` starter, metadata, play checks, asset provenance and catalog submission.

[한국어 reference](DEVELOPMENT_GUIDE.ko.md) · [English demo](https://yavn.vercel.app/en/) · [Make a web game](https://yavn.vercel.app/en/create/)

YAVN is a YAML-based visual novel engine for browser games and choice-driven story RPGs. Write scenes, dialogue and choices, then add state, inventory, licensed artwork, sound or Live2D. It is a narrative runtime, not a 3D combat or tile-map editor.

## Start a project

Use Node 22.13 or later and the pinned pnpm version in package.json. Run `pnpm install`, `pnpm test` and `pnpm dev`.

Use the repository's [sample.yaml](../sample.yaml) and existing packages under `public/game-list/` as executable references. The DSL is YAML V3: `config.yaml` contains game identity and presentation, `base.yaml` shared assets/state/inventory, and numbered chapter files contain scripts and scenes. Keep asset paths relative to the declaring package unless explicitly referencing shared root assets.

A minimal chapter excerpt:

```yaml
chapterTitle: The letter
script: [{scene: opening}]
scenes:
  opening:
    title: A letter arrives
    actions:
      - say: {text: The envelope bears my name.}
```

For a complete runnable package, copy `examples/game-template/` as described in the game submission guide. Copying a chapter excerpt alone is not a complete ZIP game.

## Narrative and presentation

- Use named scenes and choices to create branches, merges and endings. Preserve stable action/choice identifiers when updating an existing published game, because saved progress refers to them.
- State and inventory can control story progression. Item acquisition and use are distinct from arbitrary game state.
- Characters, backgrounds, music, sound effects and video belong in the declared assets. Respect asset licenses and game-specific legal notices.
- Start-screen image positioning supports desktop and mobile focal points. Live2D and cinematic effects are optional; verify fallback and mobile behavior.
- Test all branches and ending conditions. Save/load, automatic checkpoints, manual saves and exported save backups are separate controls.

## Story map

The story map shows discovered scenes and branches by chapter, with the current position centered. Unvisited chapters and scenes are omitted, and only travelled connections and selected options appear. Return to a replayable point to restore inventory, relationships and logs for that point. Exploration records remain across replay sessions when browser storage is available.

## Launcher language metadata

`launcher.yaml` is catalog metadata; `languages` does not translate dialogue or change the game DSL.

```yaml
languages: [ko]
summary: A Korean-language mystery with branching choices.
tags: [mystery, visual-novel]
```

Only list languages that the playable package actually supports. Use `[en]` for a fully English game, or `[ko, en]` only if both complete story variants are available. An omitted list is displayed as “Not specified”, never inferred from the interface. Language codes are deduplicated and validated as BCP-47-style tags. The launcher shows language labels on featured demos and cards; search accepts codes and Korean/English language names, with a separate language filter.

## Interface vs story language

The Korean launcher is `/`; English is `/en/`. Links opened from the English launcher carry `?ui=en` to retain English engine controls. This query is excluded from game canonical URLs. Menu, saves, inventory, playback controls, recovery and story-map controls are localized. Creator-written titles, story dialogue, choices, item descriptions and legal notices keep their original language.

## Public search pages

Build with `pnpm build`. The build writes readable initial HTML, per-game metadata and language declarations, Korean/English creation guides, canonical and language-alternate links, sitemap and robots rules. Private uploaded ZIP files and local saves are not added to the public catalog. Search engines decide indexing and rankings; keyword metadata alone does not guarantee visibility.

## Release checklist

Run the full unit suite and production build. Verify `/`, `/en/`, `/create/`, `/en/create/`, the sitemap and a playable game. Check language filtering, keyboard access, mobile overflow and a representative save/recovery path. Rebuild the manifest when launcher metadata changes.

## 2026-10-20 behavior update

Added English launcher/engine controls, verified game-language declarations, language-aware catalog search and filters, and Korean/English web-game creation/search pages. The story DSL, save format and game content are unchanged. The full Korean reference remains the detailed API reference for advanced actions and effects.

Use `translations.en.summary` in launcher.yaml for an English catalog summary. This is editorial metadata and does not imply the story supports English.

## Main story: Muwon (2026-11-13)

The library's main story is *Muwon — Hanseong Inquest Records* (`public/game-list/muwon/`), a five-chapter forensic mystery set in 1792 Hanseong. Characters and cases are original; only the period and historical inquest methods are borrowed. Art is hand-authored SVG and the score is synthesized by `scripts/generate-muwon-score.py`. The Deokman story, its English opening edition and the English prologue generator were removed. It is currently Korean only.

## Player conveniences (2026-11-13)

- **Skip read text**: the dialogue box's Skip button fast-forwards lines already read in this game and stops at unread lines, choices, inputs, videos, game overs and endings. Read history is kept per game in the browser.
- **Faster first scene**: chapter loading waits only for assets of the start scene and scenes up to two jumps away; the rest keep loading after the scene starts.
- Exploration choices show a hint, listed options are numbered in visible order, in-game text is at least 12px, and the usage-statistics prompt no longer hides behind the title screen or covers the dialogue box.

## Player names, placeholders and save slots (2026-11-13)

- An `input` without `correct` is free text; `saveAs` is required, with optional `defaultValue` and `maxLength` (default 12).
- `{{var}}` placeholders fill dialogue, prompts, options, character `name`, game-over and ending text from state. `{{var|은}}` attaches the Korean particle that agrees with the value's final sound.
- Settings offers three manual save slots, and library cards show a resumable save and found endings.

## Caption cards, phone messages and three new stories (2026-11-13)

- `say.channel: card` shows a full-screen caption card (time jumps, title drops, blackouts); `say.channel: message` renders a phone chat bubble with `say.side: me | them`; `say.erase: true` strikes and wipes a line after it is shown.
- New games built from the owner's stories: ERASE (4 chapters), ERASE: First to Erase (5 chapters) and 8-bit Heart (5 chapters). The ERASE pair carries content notes (sexual tension without description, HIV anxiety, self-destructive thoughts) with crisis-line and anonymous testing information.
