# Writing the opening chapters

The Korean full stories and the English opening editions share their scene IDs, choice keys, conditions, rewards and performance timing. English editions end at the translated chapter boundary; they do not load a Korean chapter automatically.

## Character relationships

In Deokman's first chapter, the king admits that protecting his daughter also meant refusing to see her loneliness. His request that she leave hurts because she has spent her life waiting for him. Sohwa's earlier instruction to hold her hand returns at the drain: Deokman refuses to go first without her. Use the existing worried, serious and nervous portraits, restrained delivery cues and physical responses at these turning points.

Avoid explaining an emotion immediately after the action has already shown it. Keep fear, affection and resentment specific to the person being addressed. Let a reply answer the previous line before introducing the next piece of plot.

## English editions

- `english-deokman` contains chapter one, including all investigation choices, failure outcomes and the drain escape. It does not include the remaining eleven chapters.
- It reuses the original artwork and audio. Some illustrated documents retain Korean lettering; their readable records and inventory descriptions are in English.
- Character names are romanized in speaker labels without changing the underlying conditions or choice keys.

Translation sources live in `content/localizations/*-opening.en.json`. Each key is the exact Korean reading text, and each value is its English counterpart. Keep speed tags intact. `scripts/generate-english-prologues.mjs` rejects missing translations and generates the English YAML before development and production builds. When editing Korean dialogue, update its translation key and value together.

Tests resolve the English chapter, verify shared assets, preserve choice logic and delivery cues, and check that the edition never enters an untranslated chapter. Emotional quality still requires reading the conversation in sequence in both languages.
