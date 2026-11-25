import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneUnreadMark } from './App';
import { handleAdvance, loadGameFromUrl, loadSaveSlot, restartFromBeginning, saveCurrentProgress, setScenePresentationPaused } from './engine';
import { selectPhoneThread } from './phoneThread';
import { actionSchema } from './schema';
import { useVNStore } from './store';
// The engine imports the YAML parser lazily; load it up front so fake timers do not race it.
import './parser';

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

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

describe('marking a message unread from a script', () => {
  it('takes true for a one-to-one chat and a count for a group', () => {
    const one = message({ unread: true, text: '하린아' });
    const group = message({ unread: 32, text: '다들 봤어?' });
    expect(one.success && (one.data as any).say.unread).toBe(true);
    expect(group.success && (group.data as any).say.unread).toBe(32);
    expect(message({ unread: false, text: '읽음' }).success).toBe(true);
    expect(message({ unread: 0, text: '읽음' }).success).toBe(true);
  });

  it('refuses a count it cannot print', () => {
    expect(message({ unread: -1, text: 'x' }).success).toBe(false);
    expect(message({ unread: 1.5, text: 'x' }).success).toBe(false);
    expect(message({ unread: '1', text: 'x' }).success).toBe(false);
    expect(message({ unread: 1000, text: 'x' }).success).toBe(false);
  });

  it('applies only to message lines', () => {
    const spoken = actionSchema.safeParse({ say: { char: '지영', unread: true, text: '응' } });
    expect(spoken.success).toBe(false);
  });

  it('keeps the live line’s count until the box is cleared', () => {
    const set = useVNStore.getState().setDialog;
    set({ channel: 'message', speaker: '아진', fullText: '하린아', visibleText: '', unread: 1 });
    expect(useVNStore.getState().dialog.unread).toBe(1);
    set({ channel: 'message', fullText: '', visibleText: '', media: { src: '/photo.png', kind: 'image' }, unread: 3 });
    expect(useVNStore.getState().dialog.unread).toBe(3);
    set({ speaker: undefined, fullText: '', visibleText: '', typing: false });
    expect(useVNStore.getState().dialog.unread).toBeUndefined();
  });

  it('shows the example in sample.yaml as valid script', () => {
    const sample = yaml.load(source('../sample.yaml')) as { scenes: Record<string, { actions: unknown[] }> };
    const actions = sample.scenes.phone_unread.actions;
    expect(actions.every(action => actionSchema.safeParse(action).success)).toBe(true);
    expect(actions.some(action => (action as any).say?.unread === true)).toBe(true);
  });
});

describe('the unread mark on screen', () => {
  const render = (count?: number) => renderToStaticMarkup(createElement(PhoneUnreadMark, { count }));

  it('prints a small 1 that a screen reader hears as unread', () => {
    expect(render(1)).toBe('<span class="phone-unread" role="img" aria-label="읽지 않음">1</span>');
  });

  it('prints a group’s count', () => {
    expect(render(32)).toBe('<span class="phone-unread" role="img" aria-label="32명 읽지 않음">32</span>');
  });

  it('prints nothing for a message that has been read', () => {
    expect(render(undefined)).toBe('');
    expect(render(0)).toBe('');
  });

  it('hangs beside the bubble, after the message, on old and live bubbles alike', () => {
    const app = source('./App.tsx');
    const thread = app.slice(app.indexOf('<ol className="phone-thread">'), app.indexOf('</ol>', app.indexOf('<ol className="phone-thread">')));
    // After the body, so the row's bottom alignment puts it at the bubble's lower corner,
    // and outside it, so it is never drawn inside the bubble or the photo.
    expect(thread).toMatch(/<\/span>\s*<PhoneUnreadMark count=\{bubble\.unread\} \/>\s*<\/li>/);
    const live = app.slice(app.indexOf('phone-thread-bubble phone-live'));
    expect(live).toMatch(/\{dialogHasText && <DialogueText \/>\}\s*<\/div>\s*<PhoneUnreadMark count=\{dialogUnread\} \/>/);
  });

  it('sits left of what you sent and right of what came in, in the phone’s own colours', () => {
    const css = source('./gameInterface.css');
    expect(css).toMatch(/\.phone-thread-bubble \{[^}]*display: flex;[^}]*align-items: flex-end;/);
    expect(css).toMatch(/\.phone-thread-bubble\.side-me \{[^}]*flex-direction: row-reverse;/);
    expect(css).toMatch(/\.dialog-box\.channel-message \{[^}]*--phone-unread: #[0-9a-f]{6};/);
    const rule = css.match(/\.app \.phone-unread \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('color: var(--phone-unread);');
    expect(rule).toContain('font-weight: 700;');
    expect(rule).not.toMatch(/gradient|shadow|animation|transition/);
  });
});

const phoneDocuments: Record<string, string> = {
  'config.yaml': 'title: Phone\nversion: "1"\ntextSpeed: 30\nautoSave: true\nclickToInstant: true\n',
  '0.yaml': `script: [{scene: chat}]
scenes:
  chat:
    actions:
      - say: {channel: message, thread: 하린, side: me, speakerName: 아진, unread: true, text: 하린아}
      - say: {channel: message, thread: 하린, side: them, speakerName: 하린, text: 누구세요?}
      - say: {channel: message, thread: 하린, side: me, speakerName: 아진, unread: 3, text: 나야}
      - say: {channel: message, thread: 하린, side: me, speakerName: 아진, text: 답장 좀}
      - gameOver: {title: End}
`,
};

describe('an unread message played through the engine', () => {
  async function advance() {
    handleAdvance(true);
    await vi.advanceTimersByTimeAsync(400);
    if (useVNStore.getState().dialog.typing) {
      handleAdvance(true);
      await vi.advanceTimersByTimeAsync(50);
    }
  }
  const threadCounts = () => selectPhoneThread(useVNStore.getState().storyLog).map(bubble => [bubble.text, bubble.unread]);

  beforeEach(() => {
    vi.useFakeTimers();
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('location', { origin: 'http://test', href: 'http://test/' });
    vi.stubGlobal('document', { querySelectorAll: () => [], visibilityState: 'visible' });
    vi.stubGlobal('navigator', { hardwareConcurrency: 2, connection: { saveData: true } });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (timer: number) => clearTimeout(timer));
    vi.stubGlobal('Audio', class { volume = 0; play() { return Promise.resolve(); } pause() {} addEventListener() {} });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = phoneDocuments[new URL(url).pathname.split('/').pop()!] ?? '';
      return new Response(body, { status: body ? 200 : 404, headers: { 'content-type': 'text/yaml' } });
    }));
    setScenePresentationPaused(false);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the same mark on the same bubble through the thread, a save and a load', async () => {
    const load = loadGameFromUrl('http://test/phone/');
    await vi.advanceTimersByTimeAsync(2500);
    await load;
    expect(useVNStore.getState().dialog).toMatchObject({ fullText: '하린아', channel: 'message', unread: 1 });

    await advance();
    expect(useVNStore.getState().dialog.unread).toBeUndefined();
    expect(threadCounts()).toEqual([['하린아', 1]]);

    await advance();
    expect(useVNStore.getState().dialog).toMatchObject({ fullText: '나야', unread: 3 });
    expect(threadCounts()).toEqual([['하린아', 1], ['누구세요?', undefined]]);
    expect(saveCurrentProgress('manual').exists).toBe(true);

    await advance();
    expect(threadCounts()).toEqual([['하린아', 1], ['누구세요?', undefined], ['나야', 3]]);

    const restart = restartFromBeginning();
    await vi.advanceTimersByTimeAsync(2500);
    await restart;
    const loaded = loadSaveSlot('manual');
    await vi.advanceTimersByTimeAsync(2500);
    expect(await loaded).toBe(true);
    expect(useVNStore.getState().dialog).toMatchObject({ fullText: '나야', unread: 3 });
    expect(threadCounts()).toEqual([['하린아', 1], ['누구세요?', undefined]]);
  });
});
