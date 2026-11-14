import type { StoryLogEntry } from './types';

export type PhoneThreadBubble = {
  key: string;
  speaker?: string;
  text: string;
  side: 'me' | 'them';
};

/**
 * How far back a thread is drawn. Enough that a phone scene reads as a conversation,
 * short enough that the oldest bubbles do not push the live line off a small screen.
 */
export const PHONE_THREAD_MAX_BUBBLES = 10;

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
      text: entry.text,
      side: entry.side ?? 'them',
    });
  }

  return bubbles.reverse();
}

export type PhoneContact = { name: string; group: boolean };

/**
 * Who the phone screen is talking to.
 *
 * One correspondent names the header, and then repeating that name over every bubble is
 * something only a mock-up does. Several correspondents mean a group thread, so the header
 * says who is in it and the names stay on the bubbles, where they tell you who is talking.
 */
export function selectPhoneContact(
  bubbles: PhoneThreadBubble[],
  live?: { speaker?: string; side?: 'me' | 'them' },
): PhoneContact | undefined {
  const names: string[] = [];
  const add = (name?: string) => {
    if (name && !names.includes(name)) names.push(name);
  };
  for (const bubble of bubbles) if (bubble.side === 'them') add(bubble.speaker);
  if (live && live.side !== 'me') add(live.speaker);
  if (names.length === 0) return undefined;
  if (names.length === 1) return { name: names[0], group: false };
  return { name: `${names[0]} 외 ${names.length - 1}`, group: true };
}
