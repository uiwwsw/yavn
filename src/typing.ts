import type { DialogueDelivery } from './types';

export type InlineSpeedSegment = {
  start: number;
  end: number;
  speed: number;
};

export type TypingStep = {
  visibleText: string;
  delayMs: number;
  intensity: number;
  grapheme: string;
};

type TypingProfile = {
  speedMultiplier: number;
  jitter: number;
  intensity: number;
  commaPauseMs: number;
  sentencePauseMs: number;
  ellipsisPauseMs: number;
  linePauseMs: number;
};

const DEFAULT_DELIVERY: DialogueDelivery = 'neutral';
const JITTER_WAVE = [0, 0.72, -0.42, 0.28, -0.68, 0.5, -0.2, 0.84, -0.54] as const;

const DELIVERY_PROFILES: Record<DialogueDelivery, TypingProfile> = {
  neutral: {
    speedMultiplier: 1,
    jitter: 0.02,
    intensity: 0.12,
    commaPauseMs: 80,
    sentencePauseMs: 150,
    ellipsisPauseMs: 280,
    linePauseMs: 180,
  },
  calm: {
    speedMultiplier: 0.9,
    jitter: 0.03,
    intensity: 0.1,
    commaPauseMs: 110,
    sentencePauseMs: 190,
    ellipsisPauseMs: 330,
    linePauseMs: 220,
  },
  nervous: {
    speedMultiplier: 1.02,
    jitter: 0.3,
    intensity: 0.54,
    commaPauseMs: 115,
    sentencePauseMs: 210,
    ellipsisPauseMs: 480,
    linePauseMs: 250,
  },
  angry: {
    speedMultiplier: 1.2,
    jitter: 0.12,
    intensity: 0.78,
    commaPauseMs: 55,
    sentencePauseMs: 105,
    ellipsisPauseMs: 210,
    linePauseMs: 130,
  },
  whisper: {
    speedMultiplier: 0.76,
    jitter: 0.08,
    intensity: 0.18,
    commaPauseMs: 125,
    sentencePauseMs: 220,
    ellipsisPauseMs: 420,
    linePauseMs: 260,
  },
  shout: {
    speedMultiplier: 1.34,
    jitter: 0.1,
    intensity: 1,
    commaPauseMs: 40,
    sentencePauseMs: 80,
    ellipsisPauseMs: 170,
    linePauseMs: 100,
  },
  sad: {
    speedMultiplier: 0.7,
    jitter: 0.1,
    intensity: 0.24,
    commaPauseMs: 145,
    sentencePauseMs: 260,
    ellipsisPauseMs: 560,
    linePauseMs: 300,
  },
  deduction: {
    speedMultiplier: 0.94,
    jitter: 0,
    intensity: 0.42,
    commaPauseMs: 105,
    sentencePauseMs: 205,
    ellipsisPauseMs: 360,
    linePauseMs: 230,
  },
};

const EMOTION_DELIVERY_MAP: Record<string, DialogueDelivery> = {
  angry: 'angry',
  nervous: 'nervous',
  worried: 'nervous',
  scared: 'nervous',
  serious: 'deduction',
  think: 'deduction',
  surprised: 'shout',
  proud: 'calm',
  sad: 'sad',
  whisper: 'whisper',
  calm: 'calm',
};

type SegmenterResult = Iterable<{ segment: string; index: number }>;
type SegmenterLike = {
  segment: (value: string) => SegmenterResult;
};
type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' },
) => SegmenterLike;

const getGraphemeSegments = (text: string): Array<{ grapheme: string; start: number; end: number }> => {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), ({ segment, index }) => ({
      grapheme: segment,
      start: index,
      end: index + segment.length,
    }));
  }

  let offset = 0;
  return Array.from(text, (grapheme) => {
    const start = offset;
    offset += grapheme.length;
    return { grapheme, start, end: offset };
  });
};

const resolveSegmentSpeed = (
  start: number,
  end: number,
  defaultSpeed: number,
  segments: InlineSpeedSegment[],
): number => {
  const segment = segments.find((candidate) => end > candidate.start && start < candidate.end);
  return segment?.speed ?? defaultSpeed;
};

const resolvePauseAfter = (
  precedingText: string,
  nextGrapheme: string,
  profile: TypingProfile,
): number => {
  if (nextGrapheme === '.' && /\.$/.test(precedingText)) return 24;
  if (/(?:\.\.\.|…)[\"'”’)]?$/.test(precedingText)) return profile.ellipsisPauseMs;
  if (/[.!?。！？][\"'”’)]?$/.test(precedingText)) return profile.sentencePauseMs;
  if (/[,，、;:：]$/.test(precedingText)) return profile.commaPauseMs;
  if (/\n$/.test(precedingText)) return profile.linePauseMs;
  return 0;
};

export function parseInlineSpeed(text: string): { text: string; segments: InlineSpeedSegment[] } {
  const pattern = /<speed=(\d+)>([\s\S]*?)<\/speed>/gi;
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length === 0) {
    return { text, segments: [] };
  }

  let cursor = 0;
  let normalizedText = '';
  const segments: InlineSpeedSegment[] = [];
  for (const match of matches) {
    const raw = match[0];
    const index = match.index ?? cursor;
    if (index > cursor) normalizedText += text.slice(cursor, index);

    const spanText = match[2] ?? '';
    const spanSpeed = Number(match[1]);
    const start = normalizedText.length;
    normalizedText += spanText;
    const end = normalizedText.length;
    if (end > start && Number.isFinite(spanSpeed) && spanSpeed > 0) {
      segments.push({ start, end, speed: Math.max(1, spanSpeed) });
    }
    cursor = index + raw.length;
  }

  if (cursor < text.length) normalizedText += text.slice(cursor);
  return { text: normalizedText, segments };
}

export function resolveDialogueDelivery(
  explicitDelivery?: DialogueDelivery,
  speakerEmotion?: string,
): DialogueDelivery {
  if (explicitDelivery) return explicitDelivery;
  if (!speakerEmotion) return DEFAULT_DELIVERY;
  return EMOTION_DELIVERY_MAP[speakerEmotion.trim().toLowerCase()] ?? DEFAULT_DELIVERY;
}

export function buildTypingPlan(options: {
  text: string;
  baseSpeed: number;
  delivery?: DialogueDelivery;
  speedSegments?: InlineSpeedSegment[];
}): TypingStep[] {
  const { text, baseSpeed, delivery = DEFAULT_DELIVERY, speedSegments = [] } = options;
  const profile = DELIVERY_PROFILES[delivery];
  const graphemes = getGraphemeSegments(text);

  return graphemes.map((entry, index) => {
    const rawCps = resolveSegmentSpeed(entry.start, entry.end, Math.max(1, baseSpeed), speedSegments);
    const wave = JITTER_WAVE[index % JITTER_WAVE.length];
    const jitterFactor = Math.max(0.55, 1 + wave * profile.jitter);
    const cps = Math.max(1, rawCps * profile.speedMultiplier * jitterFactor);
    const precedingText = text.slice(0, entry.start);
    const punctuationPause = resolvePauseAfter(precedingText, entry.grapheme, profile);
    const whitespaceFactor = /^\s$/.test(entry.grapheme) && entry.grapheme !== '\n' ? 0.62 : 1;
    const delayMs = Math.min(
      900,
      Math.max(16, Math.round((1000 / cps) * whitespaceFactor + punctuationPause)),
    );
    const intensityWave = delivery === 'nervous' ? Math.abs(wave) * 0.24 : Math.max(0, wave) * 0.08;

    return {
      visibleText: text.slice(0, entry.end),
      delayMs,
      intensity: Math.min(1, profile.intensity + intensityWave),
      grapheme: entry.grapheme,
    };
  });
}

export function splitLastGrapheme(text: string): { head: string; tail: string } {
  const segments = getGraphemeSegments(text);
  const last = segments[segments.length - 1];
  if (!last) return { head: '', tail: '' };
  return {
    head: text.slice(0, last.start),
    tail: last.grapheme,
  };
}
