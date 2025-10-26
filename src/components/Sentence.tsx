// import reactLogo from './assets/react.svg';
import { AnimatePresence, motion } from 'framer-motion';
import { Assets } from '@/Game';
import { CSSProperties, useEffect, useMemo, useState } from 'react';

// import viteLogo from '/vite.svg';
interface Sentence {
  duration?: number;
  message: string;
  asset?: string | string[];
}
interface AssetEntry {
  name: string;
  index: number;
  key: string;
}
export interface SentenceProps {
  assets?: Assets;
  data?: string | Sentence | Sentence[];
  isComplete: boolean;
  onComplete: () => void;
  speakerSide?: 'left' | 'right';
}
const defaultDuration = 100;
type AnchorType = 'head' | 'mouth' | 'body' | 'ambient';

interface EmojiMeta {
  anchor: AnchorType;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  revealAt?: number;
  delay?: number;
}

const ANCHOR_POSITIONS: Record<'left' | 'right', Record<AnchorType, CSSProperties>> = {
  left: {
    head: { top: '28%', left: '26%' },
    mouth: { top: '56%', left: '32%' },
    body: { top: '66%', left: '30%' },
    ambient: { top: '32%', left: '45%' },
  },
  right: {
    head: { top: '28%', right: '26%' },
    mouth: { top: '56%', right: '32%' },
    body: { top: '66%', right: '30%' },
    ambient: { top: '32%', right: '45%' },
  },
};

const EMOJI_META: Record<string, EmojiMeta> = {
  'emoji-bolt': { anchor: 'head', scale: 1.2, offsetX: -12, offsetY: -24, revealAt: 0.5 },
  'emoji-fire': { anchor: 'body', scale: 1.25, offsetY: -8, revealAt: 0.55 },
  'emoji-gear': { anchor: 'body', scale: 1.1, offsetX: -6, revealAt: 0.45 },
  'emoji-handshake': { anchor: 'body', scale: 1.05, offsetY: 10, revealAt: 0.6 },
  'emoji-leaf': { anchor: 'ambient', scale: 1, offsetX: 18, offsetY: -6, revealAt: 0.4, delay: 0.1 },
  'emoji-muscle': { anchor: 'body', scale: 1.1, offsetX: 6, offsetY: 6, revealAt: 0.55 },
  'emoji-relaxed': { anchor: 'mouth', scale: 1.05, offsetY: 8, revealAt: 0.6 },
  'emoji-rocket': { anchor: 'ambient', scale: 1.2, offsetX: -30, offsetY: -18, revealAt: 0.45 },
  'emoji-smile': { anchor: 'mouth', scale: 0.95, offsetY: 4, revealAt: 0.5 },
  'emoji-sparkle': { anchor: 'ambient', scale: 1.15, offsetX: 8, offsetY: -30, revealAt: 0.4, delay: 0.05 },
  'emoji-speech': { anchor: 'mouth', scale: 1, offsetX: 14, revealAt: 0.55 },
  'emoji-star': { anchor: 'ambient', scale: 1.1, offsetX: -18, offsetY: -18, revealAt: 0.45 },
  'emoji-sunrise': { anchor: 'ambient', scale: 1.05, offsetX: 24, offsetY: 6, revealAt: 0.5 },
  'emoji-surprised': { anchor: 'mouth', scale: 1.1, offsetY: -2, revealAt: 0.55 },
};

const Sentence = ({ assets, data, isComplete: isCompleteProp, onComplete, speakerSide = 'left' }: SentenceProps) => {
  const [_sentences, setSentences] = useState<Sentence[]>([]);
  const [_cursor, setCursor] = useState<number>(0);
  const [_step, setStep] = useState<number>(-1);

  const step = useMemo(() => Math.min(_step, _sentences.length), [_step, _sentences]);

  const isComplete = useMemo(() => {
    if (_cursor === 0) return false;
    return _sentences.length <= _step;
  }, [_sentences, _step]);

  const cursor = useMemo(
    () => (isCompleteProp || isComplete ? Infinity : _cursor),
    [_sentences, _cursor, isCompleteProp],
  );

  const sentence = useMemo(() => _sentences[step] ?? { message: '', duration: 0 }, [_sentences, step]);
  const sentences = useMemo(() => {
    let msg = '';
    for (const index in _sentences) {
      if (!isCompleteProp && step < +index) break;
      if (step === +index) msg += _sentences[index].message.substring(0, cursor);
      else msg += _sentences[index].message;
    }

    return msg;
  }, [_sentences, cursor, step, isCompleteProp]);
  const duration = useMemo(() => sentence.duration ?? defaultDuration, [_sentences, step]);
  // const asset = useMemo(() => sentence.asset, [_sentences, step]);
  const currentSentenceIndex = useMemo(() => {
    if (_sentences.length === 0) return -1;
    if (step < 0) return 0;
    if (step >= _sentences.length) return _sentences.length - 1;
    return step;
  }, [_sentences, step]);

  const assetArray = useMemo<AssetEntry[]>(() => {
    const entries = _sentences.flatMap((sentence, index) => {
      if (!sentence.asset) return [];
      const assetNames = Array.isArray(sentence.asset) ? sentence.asset : [sentence.asset];
      return assetNames.map((name, assetIndex) => ({ name, index, key: `${index}-${assetIndex}-${name}` }));
    });

    if (isCompleteProp) return entries;

    if (currentSentenceIndex < 0) return [];
    return entries.filter((entry) => entry.index <= currentSentenceIndex);
  }, [_sentences, currentSentenceIndex, isCompleteProp]);
  const isEndCursor = useMemo(() => sentence.message.length <= cursor, [_sentences, step, cursor]);
  const revealRatio = useMemo(() => {
    if (!sentence.message.length) return 1;
    return Math.min(cursor / sentence.message.length, 1);
  }, [sentence, cursor]);
  useEffect(() => {
    if (!data) return;
    if (data instanceof Array) setSentences(data);
    else if (data instanceof Object) setSentences([data]);
    else setSentences([{ message: data, duration: defaultDuration }]);
    setStep(0);
  }, [data]);
  useEffect(() => {
    if (!duration || isComplete) return;
    setCursor(0);
    const sti = setInterval(() => setCursor((prev) => prev + 1), duration);
    return () => clearInterval(sti);
  }, [_sentences, step, isComplete]);

  useEffect(() => {
    if (isEndCursor) setStep(step + 1);
  }, [isEndCursor]);
  useEffect(() => {
    if (isComplete) onComplete();
  }, [isComplete]);
  return (
    <>
      {assets && assetArray && (
        <>
      {assetArray
        .filter((entry) => entry.index === currentSentenceIndex)
        .map(({ name, key }) => {
          const asset = assets?.[name];
          if (!asset?.audio) return null;
          return <audio key={`audio-${key}`} src={asset.audio} autoPlay />;
        })}
      <AnimatePresence initial={false}>
        {assetArray.map(({ name, key, index }) => {
          const asset = assets?.[name];
          if (!asset?.image) return null;
          const meta = EMOJI_META[name] ?? { anchor: 'body' };
          const anchor = ANCHOR_POSITIONS[speakerSide][meta.anchor];
          if (!anchor) return null;
          const isPastSentence = index < currentSentenceIndex;
          const threshold = meta.revealAt ?? 0.65;
          const shouldShow =
            isCompleteProp || isPastSentence || (index === currentSentenceIndex && revealRatio >= threshold);
          if (!shouldShow) return null;

          const size = 96 * (meta.scale ?? 1);
          const translateX = meta.offsetX ?? 0;
          const translateY = meta.offsetY ?? 0;
          const baseTransform = speakerSide === 'right' ? 'translate(50%, -50%)' : 'translate(-50%, -50%)';
          const style: CSSProperties = {
            position: 'absolute',
            pointerEvents: 'none',
            ...anchor,
            width: `${size}px`,
            height: `${size}px`,
            transform: `${baseTransform} translate(${translateX}px, ${translateY}px)`,
          };

          const delay = (meta.delay ?? 0) + (isPastSentence ? 0 : 0.05);

          return (
            <motion.img
              key={`image-${key}`}
              className="z-30 select-none object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
              style={style}
              src={asset.image}
              alt=""
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{
                opacity: { duration: 0.3, ease: 'easeOut', delay },
                scale: { duration: 0.35, ease: 'easeOut', delay },
                y: { type: 'spring', stiffness: 180, damping: 20, delay },
              }}
            />
          );
        })}
      </AnimatePresence>
        </>
      )}
      <p className="relative flex-auto whitespace-pre-line">
        {sentences}
        {isComplete ? (
          <span className="ml-auto block w-fit animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
            </svg>
          </span>
        ) : (
          <span className="animate-ping" style={{ animationDuration: `${duration}ms` }}>
            |
          </span>
        )}
      </p>
    </>
  );
};

export default Sentence;
