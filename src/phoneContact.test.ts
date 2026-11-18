import { describe, expect, it } from 'vitest';
import { phoneAvatarPath, phoneBubbleProfile, selectPhoneContact, type PhoneSender } from './phoneThread';

const them = (speaker: string, avatar?: string, speakerId?: string): PhoneSender =>
  ({ speaker, side: 'them', avatar, speakerId });

describe('phone contacts', () => {
  it('shows the contact name instead of an internal character ID, including an outgoing first message', () => {
    const outgoing = { speaker: '지완', side: 'me' as const };
    const first = selectPhoneContact([outgoing], '동식_연락처', '/father.svg', '아버지');
    expect(first).toMatchObject({ name: '아버지', thread: '동식_연락처', participants: [{ speaker: '아버지', avatar: '/father.svg' }] });
    const reply = selectPhoneContact([outgoing, them('아버지', undefined, '동식_연락처')], '동식_연락처', '/father.svg', '아버지');
    expect(reply?.name).toBe('아버지');
    expect(phoneBubbleProfile(reply, them('아버지', undefined, '동식_연락처')).avatar).toBe('/father.svg');
  });

  it('uses the displayed sender name for an untitled chat and leaves the player out', () => {
    const contact = selectPhoneContact([them('엄마'), { speaker: '해수', side: 'me', avatar: '/haesu.svg' }]);
    expect(contact?.name).toBe('엄마');
    expect(contact?.participants.map(profile => profile.speaker)).toEqual(['엄마']);
    expect(selectPhoneContact([{ speaker: '해수', side: 'me' }, { side: 'them' }])).toBeUndefined();
  });

  it('keeps the authored title and shares the same portrait between the header and older bubbles', () => {
    const older = them('이지수', undefined, '지수');
    const live = them('이지수', '/jisu-profile.svg', '지수');
    const contact = selectPhoneContact([older, live], '지수', '/old-jisu.svg');

    expect(contact?.name).toBe('지수');
    expect(phoneBubbleProfile(contact, older)).toEqual({ speaker: '이지수', avatar: '/jisu-profile.svg' });
    expect(contact?.participants[0].avatar).toBe('/jisu-profile.svg');
  });

  it('keeps aliases of one character together and separates characters who share a name', () => {
    const unknown = them('낯선 사람', '/first.svg', 'first');
    const revealed = them('지영', undefined, 'first');
    const other = them('지영', '/second.svg', 'second');
    const contact = selectPhoneContact([unknown, revealed, other]);

    expect(contact?.participants.map(profile => [profile.speaker, profile.avatar]))
      .toEqual([['지영', '/first.svg'], ['지영', '/second.svg']]);
    expect(phoneBubbleProfile(contact, unknown)).toEqual({ speaker: '지영', avatar: '/first.svg' });
    expect(phoneBubbleProfile(contact, other).avatar).toBe('/second.svg');
  });

  it('does not borrow the room’s portrait for a different sender', () => {
    const sender = them('민석');
    const contact = selectPhoneContact([sender], '지수', '/jisu.svg');
    expect(phoneBubbleProfile(contact, sender).avatar).toBeUndefined();
    expect(contact?.participants[0].avatar).toBeUndefined();
  });

  it('uses dedicated profile art before the static sprite and rejects Live2D model assets', () => {
    expect(phoneAvatarPath({ avatar: '/profile.svg', base: '/sprite.svg' })).toBe('/profile.svg');
    expect(phoneAvatarPath({ base: '/sprite.svg' })).toBe('/sprite.svg');
    expect(phoneAvatarPath({ base: '/art.model3.json?v=1' })).toBeUndefined();
    expect(phoneBubbleProfile(undefined, them('엄마', '/old.model3.json')).avatar).toBeUndefined();
  });
});
