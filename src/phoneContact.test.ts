import { describe, expect, it } from 'vitest';
import { selectPhoneContact, type PhoneSender } from './phoneThread';

const them = (speaker: string): PhoneSender => ({ speaker, side: 'them' });
const me = (): PhoneSender => ({ side: 'me' });

describe('selectPhoneContact', () => {
  it('names the screen after the one person writing in', () => {
    expect(selectPhoneContact([them('지영'), me(), them('지영')])).toEqual({ name: '지영', group: false });
  });

  it('counts the room when more than one person is writing', () => {
    expect(selectPhoneContact([them('지영'), them('경준'), them('지영')]))
      .toEqual({ name: '지영 외 1', group: true });
  });

  it('counts the live line too, so the header is right on the first message of a scene', () => {
    expect(selectPhoneContact([], { speaker: '엄마', side: 'them' })).toEqual({ name: '엄마', group: false });
  });

  it('does not count your own messages as a correspondent', () => {
    expect(selectPhoneContact([me(), me()], { speaker: '해수', side: 'me' })).toBeUndefined();
  });

  it('leaves the header unnamed when nobody is attributed', () => {
    expect(selectPhoneContact([{ side: 'them' }])).toBeUndefined();
  });
});
