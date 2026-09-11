import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildTypingPlan,
  parseInlineSpeed,
  resolveDialogueDelivery,
  splitLastGrapheme,
} from './typing';

afterEach(() => vi.unstubAllGlobals());

describe('dialogue delivery', () => {
  it('infers delivery from character emotion and lets the DSL override it', () => {
    expect(resolveDialogueDelivery(undefined, 'nervous')).toBe('nervous');
    expect(resolveDialogueDelivery(undefined, 'serious')).toBe('deduction');
    expect(resolveDialogueDelivery('whisper', 'angry')).toBe('whisper');
    expect(resolveDialogueDelivery(undefined, undefined, 'calm')).toBe('calm');
    expect(resolveDialogueDelivery(undefined, 'angry', 'calm')).toBe('angry');
    expect(resolveDialogueDelivery(undefined, 'unknown')).toBe('neutral');
  });

  it('adds emotional rhythm and punctuation breathing room', () => {
    const nervous = buildTypingPlan({
      text: '잠깐... 그건 아니에요.',
      baseSpeed: 40,
      delivery: 'nervous',
    });
    const neutral = buildTypingPlan({
      text: '잠깐... 그건 아니에요.',
      baseSpeed: 40,
      delivery: 'neutral',
    });
    const afterEllipsis = nervous.find((step) => step.visibleText.endsWith('... '));

    expect(afterEllipsis?.delayMs).toBeGreaterThan(400);
    expect(new Set(nervous.map((step) => step.delayMs)).size).toBeGreaterThan(
      new Set(neutral.map((step) => step.delayMs)).size,
    );
    expect(nervous.some((step) => step.intensity > 0.54)).toBe(true);
  });

  it('keeps inline speed spans while applying the delivery profile', () => {
    const parsed = parseInlineSpeed('<speed=20>천천히.</speed><speed=80>지금!</speed>');
    const plan = buildTypingPlan({
      text: parsed.text,
      baseSpeed: 40,
      delivery: 'angry',
      speedSegments: parsed.segments,
    });
    const slowStep = plan.find((step) => step.visibleText === '천');
    const fastStep = plan.find((step) => step.visibleText.endsWith('지금'));

    expect(parsed.text).toBe('천천히.지금!');
    expect(slowStep?.delayMs).toBeGreaterThan(fastStep?.delayMs ?? Number.MAX_SAFE_INTEGER);
  });

  it('does not split emoji or composed graphemes', () => {
    const plan = buildTypingPlan({ text: 'A👩‍💻한', baseSpeed: 40 });

    expect(plan.map((step) => step.grapheme)).toEqual(['A', '👩‍💻', '한']);
    expect(splitLastGrapheme('A👩‍💻')).toEqual({ head: 'A', tail: '👩‍💻' });
  });

  it.each(['한', 'e\u0301', '👨‍👩‍👧‍👦', '🇰🇷', '👍🏽', '\r\n'])('keeps the final %s grapheme intact in long dialogue', (tail) => {
    const head = '문밖에서 발소리가 들렸다. '.repeat(40);
    expect(splitLastGrapheme(head + tail)).toEqual({ head, tail });
  });

  it('handles empty text and the code point fallback without Segmenter', () => {
    expect(splitLastGrapheme('')).toEqual({ head: '', tail: '' });
    vi.stubGlobal('Intl', { Segmenter: undefined });
    expect(splitLastGrapheme('한😀')).toEqual({ head: '한', tail: '😀' });
    expect(buildTypingPlan({ text: '한😀', baseSpeed: 30 }).map(step => step.grapheme)).toEqual(['한', '😀']);
  });

  it('supports iterable-only Segmenter implementations', () => {
    vi.stubGlobal('Intl', { Segmenter: class {
      segment() { return [{ segment: 'A', index: 0 }, { segment: 'e\u0301', index: 1 }]; }
    } });
    expect(splitLastGrapheme('Ae\u0301')).toEqual({ head: 'A', tail: 'e\u0301' });
  });
});
