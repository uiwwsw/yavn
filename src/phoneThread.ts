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

/**
 * The bubbles that belong above the line being spoken right now.
 *
 * A phone conversation is the unbroken run of `message` lines ending at the live one,
 * so anything else — a narration line, someone speaking in the room — closes the thread
 * and the next phone scene starts empty. The live line itself is left out: the view
 * renders that one separately so it can still type itself out.
 */
export function selectPhoneThread(
  storyLog: StoryLogEntry[],
  { limit = PHONE_THREAD_MAX_BUBBLES }: { limit?: number } = {},
): PhoneThreadBubble[] {
  const bubbles: PhoneThreadBubble[] = [];

  for (let index = storyLog.length - 2; index >= 0 && bubbles.length < limit; index -= 1) {
    const entry = storyLog[index];
    if (entry.kind !== 'dialogue' || entry.channel !== 'message') break;
    bubbles.push({
      key: `${entry.chapterPath ?? ''}#${entry.sceneId}#${entry.actionIndex}`,
      ...(entry.speaker ? { speaker: entry.speaker } : {}),
      ...(entry.avatar ? { avatar: entry.avatar } : {}),
      ...(entry.media ? { media: entry.media } : {}),
      text: entry.text,
      side: entry.side ?? 'them',
      leadsRun: true,
      endsRun: true,
      emojiOnly: isEmojiOnly(entry.text),
    });
  }

  bubbles.reverse();
  // Walking forward is the only way to know what came before a bubble; the loop above runs
  // backwards from the live line, and the oldest bubble it reaches opens a run by definition.
  // The run the thread ends on may carry on into the live line, which is why the last bubble
  // is measured against that line and not simply called the end of its run.
  const live = toSender(storyLog[storyLog.length - 1]);
  return bubbles.map((bubble, index) => {
    const next = bubbles[index + 1] ?? live;
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
  if (names.length === 0) return undefined;
  const faces = names.map((name) => avatars.get(name)).filter((avatar): avatar is string => Boolean(avatar));
  if (names.length === 1) return { name: names[0], group: false, avatars: faces };
  return { name: `${names[0]} 외 ${names.length - 1}`, group: true, avatars: faces.slice(0, 3) };
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
