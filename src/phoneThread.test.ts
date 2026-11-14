import { describe, expect, it } from 'vitest';
import { selectPhoneThread } from './phoneThread';
import type { StoryLogEntry } from './types';

const message = (
  text: string,
  side: 'me' | 'them',
  actionIndex: number,
  speaker?: string,
): StoryLogEntry => ({
  kind: 'dialogue',
  channel: 'message',
  text,
  side,
  ...(speaker ? { speaker } : {}),
  chapterPath: './1.yaml',
  sceneId: 'chat',
  actionIndex,
});

const spoken = (text: string, actionIndex: number): StoryLogEntry => ({
  kind: 'dialogue',
  channel: 'dialogue',
  speaker: '지수',
  text,
  chapterPath: './1.yaml',
  sceneId: 'chat',
  actionIndex,
});

describe('selectPhoneThread', () => {
  it('keeps the bubbles before the live line, oldest first', () => {
    const thread = selectPhoneThread([
      message('들어왔어?', 'them', 1),
      message('?', 'them', 2),
      message('지금 감', 'me', 3),
    ]);

    expect(thread.map((bubble) => bubble.text)).toEqual(['들어왔어?', '?']);
    expect(thread.map((bubble) => bubble.side)).toEqual(['them', 'them']);
  });

  it('leaves out the live line so the view can type it', () => {
    const thread = selectPhoneThread([message('a', 'them', 1), message('b', 'me', 2)]);
    expect(thread.map((bubble) => bubble.text)).toEqual(['a']);
  });

  it('starts a new thread after someone speaks in the room', () => {
    const thread = selectPhoneThread([
      message('어제 그거 봤어?', 'them', 1),
      spoken('밥 먹었냐.', 2),
      message('지금 어디야', 'them', 3),
      message('가는 중', 'me', 4),
    ]);

    expect(thread.map((bubble) => bubble.text)).toEqual(['지금 어디야']);
  });

  it('stops at the limit, keeping the newest bubbles', () => {
    const log = Array.from({ length: 20 }, (_, index) => message(`line ${index}`, 'them', index));
    const thread = selectPhoneThread(log, { limit: 3 });

    // 19 is the live line, so the thread ends at 18.
    expect(thread.map((bubble) => bubble.text)).toEqual(['line 16', 'line 17', 'line 18']);
  });

  it('carries the speaker through and defaults an unlabelled bubble to the other side', () => {
    const thread = selectPhoneThread([
      { kind: 'dialogue', channel: 'message', text: '왔어?', chapterPath: './1.yaml', sceneId: 'chat', actionIndex: 1 },
      message('응', 'me', 2, '도윤'),
      message('지금', 'me', 3),
    ]);

    expect(thread[0]).toMatchObject({ text: '왔어?', side: 'them' });
    expect(thread[1]).toMatchObject({ text: '응', side: 'me', speaker: '도윤' });
  });

  it('returns nothing when the live line opens the conversation', () => {
    expect(selectPhoneThread([spoken('…', 1), message('안녕하세요 혹시 아직 있나요', 'me', 2)])).toEqual([]);
    expect(selectPhoneThread([])).toEqual([]);
  });
});
