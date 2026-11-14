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
