import { countGraphemes } from './typing';
import type { PhoneMedia, StoryLogEntry } from './types';

export type PhoneThreadBubble = {
  key: string;
  speaker?: string;
  /** The sender's profile picture, drawn once per run beside the run's last bubble. */
  avatar?: string;
  text: string;
  media?: PhoneMedia;
  side: 'me' | 'them';
  /** True when this bubble opens a run, which is the only place the sender is named. */
  leadsRun: boolean;
  /** True when this bubble closes a run, which is where the profile picture sits. */
  endsRun: boolean;
  /** A message that is nothing but a few emoji, which a messenger shows without a bubble. */
  emojiOnly: boolean;
};

/** The part of a message that decides who is talking: used for runs and for the header. */
export type PhoneSender = { speaker?: string; side?: 'me' | 'them' };

/**
 * Whether a message opens a new run.
 *
 * Someone sending three messages in a row is one person talking, and a messaging app names
 * them once. Repeating the name over every bubble is how a transcript reads, not a thread.
 */
export function leadsRun(previous: PhoneSender | undefined, current: PhoneSender): boolean {
  if (!previous) {
    return true;
  }
  return (previous.side ?? 'them') !== (current.side ?? 'them') || previous.speaker !== current.speaker;
}

/**
 * Emoji carry a message on their own, so a messenger drops the bubble and draws them large —
 * up to three of them. A fourth turns it back into ordinary text, because at that point the
 * emoji are a sentence rather than a reaction.
 *
 * Only pictographs count. Digits and `#` are emoji components too, as the keycap sequences
 * 1️⃣ and #️⃣ are built from them, so a plain "2027" would pass a test written around the
 * Emoji property and get blown up to forty pixels.
 */
const EMOJI_RUN = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|️|‍|\s)+$/u;
const MAX_LARGE_EMOJI = 3;

export function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || !EMOJI_RUN.test(trimmed)) {
    return false;
  }
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) {
    return false;
  }
  // A flag and a family are each one emoji; counting code points would call them five.
  return countGraphemes(trimmed) <= MAX_LARGE_EMOJI;
}

/**
 * How far back a thread is drawn. Enough that a phone scene reads as a conversation,
 * short enough that the oldest bubbles do not push the live line off a small screen.
 */
export const PHONE_THREAD_MAX_BUBBLES = 10;

function toSender(entry: StoryLogEntry | undefined): PhoneSender | undefined {
  if (!entry || entry.kind !== 'dialogue' || entry.channel !== 'message') {
    return undefined;
  }
  return { speaker: entry.speaker, side: entry.side ?? 'them' };
}

type MessageEntry = Extract<StoryLogEntry, { kind: 'dialogue' }>;

/** An unbroken stretch of messages, and who was writing in during it. */
type MessageRun = { entries: MessageEntry[]; correspondents: Set<string> };

function isMessage(entry: StoryLogEntry): entry is MessageEntry {
  return entry.kind === 'dialogue' && entry.channel === 'message';
}

function collectRuns(storyLog: StoryLogEntry[]): MessageRun[] {
  const runs: MessageRun[] = [];
  let open: MessageRun | undefined;
  for (const entry of storyLog) {
    if (!isMessage(entry)) {
      open = undefined;
      continue;
    }
    if (entry.thread) {
      // An authored chat ends the stretch whose participants we must infer.
      open = undefined;
      runs.length = 0;
      continue;
    }
    if (!open) {
      open = { entries: [], correspondents: new Set() };
      runs.push(open);
    }
    open.entries.push(entry);
    if ((entry.side ?? 'them') !== 'me' && entry.speaker) {
      open.correspondents.add(entry.speaker);
    }
  }
  return runs;
}

/**
 * Whether an earlier stretch of messages belongs to the conversation on screen.
 *
 * A phone shows one chat, and a chat is with people, not with a scene: leaving the phone to
 * look up, to answer someone in the room, to let a moment pass, and coming back is still the
 * same conversation — so it is still on screen. Picking the phone up to write to somebody
 * else is not, and that is where the thread ends.
 *
 * Shared names decide it, which is what lets a group thread keep its whole cast as the run
 * is walked back. A stretch nobody is named in belongs to whatever it touches.
 */
function sameConversation(correspondents: Set<string>, run: MessageRun): boolean {
  if (correspondents.size === 0 || run.correspondents.size === 0) {
    return true;
  }
  for (const name of run.correspondents) {
    if (correspondents.has(name)) return true;
  }
  return false;
}

/**
 * The bubbles that belong above the line being spoken right now.
 *
 * The live line itself is left out: the view renders that one separately so it can still
 * type itself out.
 */
export function selectPhoneThread(
  storyLog: StoryLogEntry[],
  { limit = PHONE_THREAD_MAX_BUBBLES }: { limit?: number } = {},
): PhoneThreadBubble[] {
  const live = storyLog[storyLog.length - 1];
  if (!live || !isMessage(live)) {
    return [];
  }

  const previousEntries = storyLog.slice(0, -1);
  let entries: MessageEntry[];
  if (live.thread) {
    entries = previousEntries.filter((entry): entry is MessageEntry =>
      isMessage(entry) && entry.thread === live.thread);
  } else {
    const correspondents = new Set<string>();
    if ((live.side ?? 'them') !== 'me' && live.speaker) {
      correspondents.add(live.speaker);
    }
    entries = [];
    const runs = collectRuns(previousEntries);
    const before = previousEntries[previousEntries.length - 1];
    // An uninterrupted inferred conversation can have more than one correspondent.
    const ownRun = before && isMessage(before) && !before.thread ? runs.length - 1 : -1;
    for (let index = runs.length - 1; index >= 0; index -= 1) {
      const run = runs[index];
      if (index !== ownRun && !sameConversation(correspondents, run)) break;
      entries.unshift(...run.entries);
      for (const name of run.correspondents) correspondents.add(name);
      if (entries.length >= limit) break;
    }
  }

  const bubbles: PhoneThreadBubble[] = entries.slice(-limit).map((entry) => ({
    key: `${entry.chapterPath ?? ''}#${entry.sceneId}#${entry.actionIndex}`,
    ...(entry.speaker ? { speaker: entry.speaker } : {}),
    ...(entry.avatar ? { avatar: entry.avatar } : {}),
    ...(entry.media ? { media: entry.media } : {}),
    text: entry.text,
    side: entry.side ?? 'them',
    leadsRun: true,
    endsRun: true,
    emojiOnly: isEmojiOnly(entry.text),
  }));

  // Naming and corner-tightening follow from what comes next, and the bubble the thread ends
  // on is followed by the live line rather than by another bubble.
  const liveSender = toSender(live);
  return bubbles.map((bubble, index) => {
    const next = bubbles[index + 1] ?? liveSender;
    return {
      ...bubble,
      leadsRun: leadsRun(bubbles[index - 1], bubble),
      endsRun: next ? leadsRun(bubble, next) : true,
    };
  });
}

export type PhoneContact = { name: string; group: boolean; avatars: string[] };

/**
 * Who the phone screen is talking to.
 *
 * One correspondent names the header, and then repeating that name over every bubble is
 * something only a mock-up does. Several correspondents mean a group thread, so the header
 * says who is in it and the names stay on the bubbles, where they tell you who is talking.
 */
export function selectPhoneContact(
  bubbles: readonly (PhoneSender & { avatar?: string })[],
  live?: PhoneSender & { avatar?: string },
  thread?: string,
  threadAvatar?: string,
): PhoneContact | undefined {
  const names: string[] = [];
  const avatars = new Map<string, string>();
  const add = (sender: PhoneSender & { avatar?: string }) => {
    const { speaker, avatar } = sender;
    if (!speaker) return;
    if (!names.includes(speaker)) names.push(speaker);
    if (avatar && !avatars.has(speaker)) avatars.set(speaker, avatar);
  };
  for (const bubble of bubbles) if ((bubble.side ?? 'them') === 'them') add(bubble);
  if (live && live.side !== 'me') add(live);
  if (names.length === 0 && !thread) return undefined;
  const faces = names.map((name) => avatars.get(name)).filter((avatar): avatar is string => Boolean(avatar));
  if (names.length <= 1) {
    return { name: thread ?? names[0], group: false, avatars: faces.length || !threadAvatar ? faces : [threadAvatar] };
  }
  return { name: thread ?? `${names[0]} 외 ${names.length - 1}`, group: true, avatars: faces.slice(0, 3) };
}

/**
 * A clip's length, the way a messenger prints it on the thumbnail: 0:07, 1:42, 12:05.
 *
 * Read from the file itself once the browser has its metadata, so nobody has to type a
 * number into the script that the clip can then contradict.
 */
export function formatClipLength(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
