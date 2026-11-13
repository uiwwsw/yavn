/**
 * Body-language presets ("emote"): short one-shot motions a character plays in place.
 * They animate only the inner `.character-emote` layer, so stage position (`move`),
 * size, facing, entrances and combat on the outer `.char` keep working underneath.
 *
 * Durations here are the single source of truth: the renderer passes them to CSS as
 * `--emote-duration`, and the engine uses them for `wait` and for clearing the motion.
 */
export const CHARACTER_MOTION_IDS = [
  'nod', 'shake', 'tremble', 'shiver', 'sigh', 'slump', 'perk', 'hop', 'bounce', 'laugh', 'sob',
  'gasp', 'startle', 'recoil', 'lean_in', 'bow', 'sway', 'stomp', 'puff', 'freeze', 'headtilt', 'droop',
] as const;

export type CharacterMotion = (typeof CHARACTER_MOTION_IDS)[number];

export type CharacterMotionPreset = {
  /** One play in ms; `repeat` multiplies it. */
  duration: number;
  /** Keeps the end pose until the next motion or `move: reset`. */
  hold?: boolean;
};

export const CHARACTER_MOTIONS: Record<CharacterMotion, CharacterMotionPreset> = {
  nod: { duration: 560 },
  shake: { duration: 720 },
  tremble: { duration: 960 },
  shiver: { duration: 620 },
  sigh: { duration: 1500 },
  slump: { duration: 900, hold: true },
  perk: { duration: 460 },
  hop: { duration: 560 },
  bounce: { duration: 880 },
  laugh: { duration: 900 },
  sob: { duration: 1400 },
  gasp: { duration: 760 },
  startle: { duration: 560 },
  recoil: { duration: 760 },
  lean_in: { duration: 1200 },
  bow: { duration: 1100 },
  sway: { duration: 1400 },
  stomp: { duration: 560 },
  puff: { duration: 1000 },
  freeze: { duration: 900 },
  headtilt: { duration: 1200 },
  droop: { duration: 820, hold: true },
};

export const MAX_MOTION_REPEAT = 3;

export function isCharacterMotion(value: unknown): value is CharacterMotion {
  return typeof value === 'string' && (CHARACTER_MOTION_IDS as readonly string[]).includes(value);
}

/** Total play time; holding motions never repeat. */
export function resolveMotionDuration(motion: CharacterMotion, repeat = 1): number {
  const preset = CHARACTER_MOTIONS[motion];
  return preset.hold ? preset.duration : preset.duration * clampMotionRepeat(repeat);
}

export function clampMotionRepeat(repeat = 1): number {
  return Math.min(MAX_MOTION_REPEAT, Math.max(1, Math.round(repeat)));
}
