import { describe, expect, it } from 'vitest';
import { formatClipLength, isEmojiOnly, leadsRun, selectPhoneThread } from './phoneThread';
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

  it('keeps the conversation through someone speaking in the room', () => {
    const thread = selectPhoneThread([
      message('어제 그거 봤어?', 'them', 1, '지영'),
      spoken('밥 먹었냐.', 2),
      message('지금 어디야', 'them', 3, '지영'),
      message('가는 중', 'me', 4, '해수'),
    ]);

    expect(thread.map((bubble) => bubble.text)).toEqual(['어제 그거 봤어?', '지금 어디야']);
  });

  it('ends the thread when the phone is picked up to write to somebody else', () => {
    const thread = selectPhoneThread([
      message('어제 그거 봤어?', 'them', 1, '지영'),
      spoken('밥 먹었냐.', 2),
      message('퇴근했니', 'them', 3, '엄마'),
      message('지금 가요', 'me', 4, '해수'),
    ]);

    expect(thread.map((bubble) => bubble.text)).toEqual(['퇴근했니']);
  });

  it('keeps a group thread whole, however late in it someone first wrote', () => {
    const thread = selectPhoneThread([
      message('나도 갈래', 'them', 1, '경준'),
      message('그래', 'them', 2, '지영'),
      spoken('밖에서 소리가 났다.', 3),
      message('어디까지 왔어', 'them', 4, '지영'),
      message('거의 다 왔어', 'them', 5, '경준'),
    ]);

    expect(thread.map((bubble) => bubble.text)).toEqual(['나도 갈래', '그래', '어디까지 왔어']);
  });

  it('joins a stretch nobody is named in to whatever it touches', () => {
    const thread = selectPhoneThread([
      message('하나', 'them', 1),
      spoken('조용하다.', 2),
      message('둘', 'them', 3, '지영'),
      message('셋', 'them', 4, '지영'),
    ]);

    expect(thread.map((bubble) => bubble.text)).toEqual(['하나', '둘']);
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

describe('naming a run of messages', () => {
  it('names the first of a run and leaves the rest of it unnamed', () => {
    const thread = selectPhoneThread([
      message('바꿔 줄 수 있어?', 'them', 0, '지영'),
      message('7시에 끝나', 'them', 1, '지영'),
      message('저번 주에도 그러셨잖아요', 'them', 2, '경준'),
      message('걔는 안 바꿔 줬어', 'them', 3, '지영'),
      message('live', 'them', 4, '지영'),
    ]);
    expect(thread.map((bubble) => [bubble.speaker, bubble.leadsRun])).toEqual([
      ['지영', true],
      ['지영', false],
      ['경준', true],
      ['지영', true],
    ]);
  });

  it('starts a new run when the side changes, even for the same name', () => {
    const thread = selectPhoneThread([
      message('하나', 'them', 0, '지영'),
      message('둘', 'me', 1, '지영'),
      message('live', 'them', 2, '지영'),
    ]);
    expect(thread.map((bubble) => bubble.leadsRun)).toEqual([true, true]);
  });

  it('treats unattributed messages as one run, not as a string of strangers', () => {
    const thread = selectPhoneThread([
      message('하나', 'them', 0),
      message('둘', 'them', 1),
      message('live', 'them', 2),
    ]);
    expect(thread.map((bubble) => bubble.leadsRun)).toEqual([true, false]);
  });
});

describe('leadsRun', () => {
  it('opens a run when nothing came before', () => {
    expect(leadsRun(undefined, { speaker: '지영', side: 'them' })).toBe(true);
  });

  it('continues a run for the same person on the same side', () => {
    expect(leadsRun({ speaker: '지영', side: 'them' }, { speaker: '지영', side: 'them' })).toBe(false);
  });

  it('defaults a missing side to the other end, so it is not mistaken for your own', () => {
    expect(leadsRun({ speaker: '지영' }, { speaker: '지영', side: 'them' })).toBe(false);
    expect(leadsRun({ speaker: '지영' }, { speaker: '지영', side: 'me' })).toBe(true);
  });
});

describe('closing a run', () => {
  it('closes a run when the next message is someone else, and at the live line', () => {
    const thread = selectPhoneThread([
      message('하나', 'them', 0, '지영'),
      message('둘', 'them', 1, '지영'),
      message('셋', 'them', 2, '경준'),
      message('live', 'them', 3, '경준'),
    ]);
    expect(thread.map((bubble) => bubble.endsRun)).toEqual([false, true, false]);
  });

  it('closes the thread’s last run when the live line is someone else', () => {
    const thread = selectPhoneThread([
      message('하나', 'them', 0, '지영'),
      message('live', 'me', 1, '해수'),
    ]);
    expect(thread.map((bubble) => bubble.endsRun)).toEqual([true]);
  });

  it('closes every run when there is nothing after the thread at all', () => {
    const thread = selectPhoneThread([message('하나', 'them', 0, '지영')], { limit: 10 });
    expect(thread).toEqual([]);
  });
});

describe('what a bubble carries', () => {
  it('keeps the profile picture and the attachment the message was sent with', () => {
    const photo = { ...message('', 'them', 0, '지영'), avatar: '/char/jiyoung.svg', media: { src: '/photo.png', kind: 'image' as const } };
    const thread = selectPhoneThread([photo, message('live', 'them', 1, '지영')]);
    expect(thread[0].avatar).toBe('/char/jiyoung.svg');
    expect(thread[0].media).toEqual({ src: '/photo.png', kind: 'image' });
  });
});

describe('isEmojiOnly', () => {
  it('is true for a message that is nothing but emoji', () => {
    expect(isEmojiOnly('🙂')).toBe(true);
    expect(isEmojiOnly('🔥🔥🔥')).toBe(true);
    expect(isEmojiOnly('👍🏽')).toBe(true);
    expect(isEmojiOnly('👩‍👩‍👧 🇰🇷')).toBe(true);
  });

  it('is false once the emoji are a sentence rather than a reaction', () => {
    expect(isEmojiOnly('🙂🙂🙂🙂')).toBe(false);
  });

  it('is false for text, for numbers, and for nothing at all', () => {
    expect(isEmojiOnly('알겠어 🙂')).toBe(false);
    // Digits are emoji components, since 1️⃣ is built from one. A year is not an emoji.
    expect(isEmojiOnly('2031')).toBe(false);
    expect(isEmojiOnly('#')).toBe(false);
    expect(isEmojiOnly('   ')).toBe(false);
    expect(isEmojiOnly('')).toBe(false);
  });
});

describe('formatClipLength', () => {
  it('prints a clip the way a thumbnail does', () => {
    expect(formatClipLength(7)).toBe('0:07');
    expect(formatClipLength(62.4)).toBe('1:02');
    expect(formatClipLength(725)).toBe('12:05');
  });

  it('prints nothing when the browser has no length to report', () => {
    expect(formatClipLength(Number.NaN)).toBeUndefined();
    expect(formatClipLength(0)).toBeUndefined();
    expect(formatClipLength(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
