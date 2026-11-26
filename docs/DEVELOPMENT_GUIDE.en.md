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
- In an `explore` choice, give each scene target `at: { x: 40, y: 60 }` to place a numbered marker in the playable area. Add `investigation: { width: 1600, height: 900 }` to use percentages of the source background instead. In image-based exploration, unavailable targets display as checked, so tie each `when` to its own completion flag. See [the Muwon inquest](../public/game-list/muwon/0.yaml).
- Use `presentation: approach` with `clicks: 3` to require three consecutive activations of the same marker. Optional `reveal` lines appear on the preceding taps. Another marker starts its own sequence, and tapping the empty scene resets the sequence. See [360’s opening](../public/game-list/360/0.yaml).
- To display a single in-scene action as a marker, use `say: { text: "An envelope lies on the table.", continueLabel: "Open the envelope", at: { x: 54, y: 62 } }`. The marker continues to the next action.
- Set `choice.evidence` to a declared inventory ID to let players review an owned item's description without making a choice. Write `music: null` to stop the active background music. A later music action starts a new track.
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

## Scene continuity

- Carry a prop, sound, movement, or eyeline across a cut within the same event. Use a wide shot to establish where people are before moving in for dialogue.
- Give the previous scene a beat to land when time, place, or viewpoint changes. Use `place` or a caption card for established time and location. When two viewpoints share a moment, let the new viewpoint pick up the same action.
- Set `say.speakerName` to “Unknown woman” or another label the viewpoint character could use. Keep it on the line that reveals the name, then omit it on later lines to use the character's name. The alias also appears in messages and the story log.

## Caption cards, phone messages and three new stories (2026-11-13)

- `say.channel: card` shows a full-screen caption card (time jumps, title drops, blackouts); `say.channel: message` renders a phone messenger screen with `say.side: me | them`; `say.erase: true` strikes and wipes a line after it is shown.
- The phone header shows the authored `say.thread` title, or the other person's name. An untitled group shows one name and the number of other correspondents. Incoming groups of messages show one name in group chats and one profile beside the last bubble. The header uses the same profiles: character `avatar` first, then static `base` art, then an initial.
- Put only the message body in `say.text`; use `say.char` for the sender or `say.speakerName` for contacts without character art. Keep names and room labels out of the body. Give both incoming and outgoing messages the same `say.thread`, including the first outgoing message. If the thread is a character ID, the header resolves its display `name` and profile. Use `system` or `record` for search results rather than presenting them as messages.
- `say.media` sends a photo or a clip — a path on its own, or `{ src, kind, alt }` — which is drawn without a bubble, and lets `say.text` be left out entirely. A message of up to three emoji is drawn large and bubble-less.
- `say.unread` prints a messenger's small yellow unread count beside the bubble: `true` prints 1, a number prints that number (people in a group chat who have not read it, up to 999), and `false`, `0` or nothing prints nothing. See the 2026-11-25 update below.
- New games built from the owner's stories: ERASE (4 chapters), ERASE: First to Erase (5 chapters) and 8-bit Heart (5 chapters). The ERASE pair carries content notes (sexual tension without description, HIV anxiety, self-destructive thoughts) with crisis-line and anonymous testing information.

## Locked but visible options (2026-11-25)

`choice.options[].requires` with `lockedText` shows an option that cannot be chosen yet, with the reason. See "Locked but visible options" below.

## Unread counts on phone messages (2026-11-25)

```yaml
- say:
    channel: message
    thread: 하린
    side: me
    speakerName: 아진
    unread: true     # a yellow 1 beside the bubble
    text: "하린아"
- say: { channel: message, thread: 3반, side: me, speakerName: 아진, unread: 27, text: "다들 봤어?" }
```

- `say.unread` takes `true` (prints 1) or an integer from 0 to 999 (a group's count). It is a validation error outside `channel: message`.
- The count sits outside the bubble by its bottom corner: left of a sent bubble (`side: me`), right of a received one (`side: them`). Photo-only messages get one too. Screen readers hear "Unread" (or "Unread by 27").
- The count is stored with the line in the story log (`StoryLogEntry.unread`), so it stays on the same bubble after saving, loading or restoring from the story map. It does not clear itself when a reply arrives; use it for messages that stay unread. Existing saves and YAML are unaffected.
- `sample.yaml` has a runnable `phone_unread` scene.

## Automatic location and story-time labels

When `bg` switches to a different image, the characters on screen leave with the old place: they fade out during the transition, and in the new place only the next line's speaker and `with` cast come back. A line without `with` (narration included) does not call the old cast back. Characters staged with `char` right before the `bg` count as arriving and stay. To keep the cast through a change of angle or lighting in the same room, write `keepCast: true`.

When a background URL changes, the engine shows a nonblocking label near the top of the stage for 2.6 seconds. Repeating the same image does not retrigger it. Object-form `bg` waits for decoded transition completion; shorthand and `wait: false` retain their immediate execution.

Register each location once in `base.yaml`; individual transitions need no `place` action:

```yaml
assets:
  backgrounds:
    cafe: assets/bg/cafe.svg
    blackout: assets/bg/blackout.svg
  backgroundLabels:
    cafe: Hospital cafe
    blackout: false
```

Set `time: "15:20"` on a scene to establish story time. Background metadata may also use `{ name: Hospital cafe, time: "15:20" }`. Entering a scene applies its `time`; subsequent backgrounds inherit it. Metadata time is a fallback when no story time is known. Time carries across backgrounds, chapters and saves. The engine uses authored time, never the device clock. Without metadata, the background ID is shown with underscores/hyphens replaced by spaces; unknown time is displayed as `시간 미상` (time unknown).

```yaml
- bg: cafe
- say: { text: We ordered coffee. }
- bg: { id: blackout, label: false }
- bg: { id: cafe, label: { time: false } } # location only
- bg: { id: blackout, label: false }
- bg: { id: cafe, label: { name: false, time: "23:00" } } # time only
```

`bg.label: false` hides the entire label. An object replaces `name`/`time` with strings or hides either field with `false`; hiding both suppresses the label. Hidden time remains part of the story context. `config.yaml` can set `sceneLabels: false` to disable defaults throughout a game; `bg.label: true` or an object opts a transition back in. Base/chapter metadata merges by background ID; unknown background references are rejected.

### Locked but visible options: `requires` · `lockedText`

An option whose `when` fails is hidden. An option whose `requires` fails is **shown but cannot be chosen**. Use it to tell the player "not yet — something is missing".

```yaml
- choice:
    prompt: "The living room light is the only one on."
    options:
      - text: "Look for the clinic"
        requires: { var: discharge_paper, op: eq, value: true }   # an inventory ID works too
        lockedText: "You don't know where to start."
        goto: clinic
```

- `requires` takes the same condition syntax as `when` and must come with `lockedText` (up to 60 characters); either one alone is a validation error.
- `when` is checked first: false hides the option; true with a failing `requires` locks it.
- Listed choices draw a dimmed button with a lock and `lockedText` on a second line; mouse and number keys cannot choose it.
- In `explore`, the spot is drawn as a dashed lock instead of a number. Pressing it does not choose; it shows `lockedText` where the exploration hint sits.
- A `timeoutOptionIndex` that points at a locked option falls back to the first open option. A choice whose visible options are all locked is an authoring error.
- Locks are recalculated whenever the choice is drawn again, so a look-around scene that `set`s a flag or `get`s an item and returns to the same choice opens it.

Existing `bg.place` or a following `place` is reused once. Setup actions such as music, characters and camera may intervene; dialogue, choices, branching and waits stop that lookup. Existing caption time updates the story context; explicit `bg.label.time` takes highest priority. Explicit centered captions preserve their 1.5-second hold unless a `bg.label` object selects the automatic presentation. `label: false` also suppresses the associated legacy caption. Standalone manual `place` actions still work. Older saves reconstruct story time from their traversed script, and loading does not replay label animations. The runnable [game template](../examples/game-template/) demonstrates an uncaptioned automatic background transition.
