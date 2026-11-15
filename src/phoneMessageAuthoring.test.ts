import { describe, expect, it } from 'vitest';
import { actionSchema } from './schema';
import { useVNStore } from './store';

const message = (say: Record<string, unknown>) => actionSchema.safeParse({
  say: { channel: 'message', side: 'them', char: '지영', with: [], ...say },
});

describe('sending a photo or a clip from a script', () => {
  it('takes a path on its own', () => {
    const parsed = message({ media: 'assets/items/cctv.svg', text: '이거 봐' });
    expect(parsed.success && (parsed.data as any).say.media).toBe('assets/items/cctv.svg');
  });

  it('takes the details when the path alone will not do', () => {
    const parsed = message({ media: { src: 'assets/clip/door.mp4', kind: 'video', alt: '현관' } });
    expect(parsed.success && (parsed.data as any).say.media)
      .toEqual({ src: 'assets/clip/door.mp4', kind: 'video', alt: '현관' });
  });

  it('lets a photo be sent with no caption at all', () => {
    expect(message({ media: 'assets/items/cctv.svg' }).success).toBe(true);
  });

  it('still refuses a line that says nothing and sends nothing', () => {
    expect(message({}).success).toBe(false);
  });

  it('refuses an attachment it cannot read', () => {
    expect(message({ media: { source: 'x.png' } }).success).toBe(false);
    expect(message({ media: { src: 'x.png', kind: 'audio' } }).success).toBe(false);
  });
});

describe('a message with no text is not the dialogue box being cleared', () => {
  const set = (dialog: Parameters<ReturnType<typeof useVNStore.getState>['setDialog']>[0]) =>
    useVNStore.getState().setDialog(dialog);

  it('keeps the phone channel for a photo sent without a caption', () => {
    set({ channel: 'message', speaker: '지영', fullText: '', visibleText: '', media: { src: '/photo.png', kind: 'image' } });
    expect(useVNStore.getState().dialog.channel).toBe('message');
    expect(useVNStore.getState().dialog.media?.src).toBe('/photo.png');
  });

  it('still clears the box when an empty line carries nothing', () => {
    set({ speaker: undefined, fullText: '', visibleText: '', typing: false });
    expect(useVNStore.getState().dialog.channel).toBe('dialogue');
  });

  it('drops the attachment when the box is cleared, so it cannot outlive its message', () => {
    set({ channel: 'message', fullText: '', visibleText: '', media: { src: '/photo.png', kind: 'image' } });
    set({ speaker: undefined, fullText: '', visibleText: '', typing: false });
    expect(useVNStore.getState().dialog.media).toBeUndefined();
  });
});
