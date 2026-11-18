import { countGraphemes } from './typing';
import type { CharacterAssetDefinition, PhoneMedia, StoryLogEntry } from './types';

export type PhoneThreadBubble = {
  key: string;
  speaker?: string;
  speakerId?: string;
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
export type PhoneSender = { speaker?: string; speakerId?: string; side?: 'me' | 'them'; avatar?: string };

export function phoneAvatarPath(character?: CharacterAssetDefinition): string | undefined {
  return [character?.avatar, character?.base].find(isPhoneImage);
}

function isPhoneImage(path?: string): path is string {
  return Boolean(path && !/\.(?:json|moc3)(?:[?#]|$)/i.test(path));
}

function sameSender(a: PhoneSender, b: PhoneSender): boolean {
  return a.speakerId && b.speakerId ? a.speakerId === b.speakerId : a.speaker === b.speaker;
}

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
  return (previous.side ?? 'them') !== (current.side ?? 'them')
    || !sameSender(previous, current) || previous.speaker !== current.speaker;
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

type MessageEntry = Extract<StoryLogEntry, { kind: 'dialogue' }>;

/** An unbroken stretch of messages, and who was writing in during it. */
type MessageRun = { entries: MessageEntry[]; correspondents: PhoneSender[] };

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
      open = { entries: [], correspondents: [] };
      runs.push(open);
    }
    open.entries.push(entry);
    if ((entry.side ?? 'them') !== 'me' && entry.speaker) {
      open.correspondents.push(entry);
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
function sameConversation(correspondents: PhoneSender[], run: MessageRun): boolean {
  if (correspondents.length === 0 || run.correspondents.length === 0) {
    return true;
  }
  return run.correspondents.some(sender => correspondents.some(other => sameSender(sender, other)));
}

function selectConversationEntries(storyLog: StoryLogEntry[]): MessageEntry[] {
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
    const correspondents: PhoneSender[] = live.side !== 'me' && live.speaker ? [live] : [];
    entries = [];
    const runs = collectRuns(previousEntries);
    const before = previousEntries[previousEntries.length - 1];
    // An uninterrupted inferred conversation can have more than one correspondent.
    const ownRun = before && isMessage(before) && !before.thread ? runs.length - 1 : -1;
    for (let index = runs.length - 1; index >= 0; index -= 1) {
      const run = runs[index];
      if (index !== ownRun && !sameConversation(correspondents, run)) break;
      entries.unshift(...run.entries);
      correspondents.push(...run.correspondents);
    }
  }
  return [...entries, live];
}

export function selectPhoneConversation(
  storyLog: StoryLogEntry[],
  { limit = PHONE_THREAD_MAX_BUBBLES, threadAvatar, threadName }: { limit?: number; threadAvatar?: string; threadName?: string } = {},
): { bubbles: PhoneThreadBubble[]; contact?: PhoneContact } {
  const entries = selectConversationEntries(storyLog);
  const live = entries.at(-1);
  const contact = selectPhoneContact(entries, live?.thread, threadAvatar, threadName);

  // The live line is rendered separately so it can still type itself out.
  const bubbles: PhoneThreadBubble[] = entries.slice(Math.max(0, entries.length - 1 - limit), -1).map((entry) => ({
    key: `${entry.chapterPath ?? ''}#${entry.sceneId}#${entry.actionIndex}`,
    ...(entry.speaker ? { speaker: entry.speaker } : {}),
    ...(entry.speakerId ? { speakerId: entry.speakerId } : {}),
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
  return {
    contact,
    bubbles: bubbles.map((bubble, index) => {
      const next = bubbles[index + 1] ?? live;
      return {
        ...bubble,
        leadsRun: leadsRun(bubbles[index - 1], bubble),
        endsRun: next ? leadsRun(bubble, next) : true,
      };
    }),
  };
}

export function selectPhoneThread(storyLog: StoryLogEntry[], options?: { limit?: number }): PhoneThreadBubble[] {
  return selectPhoneConversation(storyLog, options).bubbles;
}

type PhoneProfile = { speaker: string; speakerId?: string; avatar?: string };
export type PhoneContact = { name: string; thread?: string; participants: PhoneProfile[] };

/**
 * Build the header from the conversation, independently of how many bubbles fit on screen.
 * Character IDs keep a new display name from turning the same person into another participant.
 */
export function selectPhoneContact(
  senders: readonly PhoneSender[],
  thread?: string,
  threadAvatar?: string,
  threadName?: string,
): PhoneContact | undefined {
  const participants: PhoneProfile[] = [];
  for (const sender of senders) {
    if (sender.side === 'me' || !sender.speaker) continue;
    const existing = participants.find(profile => sameSender(profile, sender));
    const avatar = isPhoneImage(sender.avatar) ? sender.avatar : undefined;
    if (existing) {
      existing.speaker = sender.speaker;
      existing.speakerId ??= sender.speakerId;
      existing.avatar = avatar ?? existing.avatar;
    } else {
      participants.push({ speaker: sender.speaker, speakerId: sender.speakerId, avatar });
    }
  }
  const first = participants[0];
  if (!first) {
    return thread ? { name: threadName ?? thread, thread, participants: [{ speaker: threadName ?? thread, avatar: threadAvatar }] } : undefined;
  }
  if (participants.length === 1 && thread && (first.speakerId === thread || first.speaker === thread)) {
    first.avatar ??= threadAvatar;
  }
  return { name: threadName ?? thread ?? first.speaker, thread, participants };
}

export function phoneBubbleProfile(contact: PhoneContact | undefined, sender: PhoneSender): PhoneProfile {
  const participant = contact?.participants.find(profile => sameSender(profile, sender));
  return {
    speaker: participant?.speaker ?? sender.speaker ?? '',
    avatar: participant?.avatar ?? (isPhoneImage(sender.avatar) ? sender.avatar : undefined),
  };
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
