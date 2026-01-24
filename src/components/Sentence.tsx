import { AnimatePresence, motion } from 'framer-motion';
import { memo, ReactNode, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Assets, SentenceData, SentenceEntry } from '../utils/novelTypes';
import { getTypingSoundGenerator } from '../utils/typingSoundGenerator';

interface AssetEntry {
  name: string;
  index: number;
  key: string;
}

export interface SentenceProps {
  assets?: Assets;
  data?: SentenceData;
  direct?: boolean;
  isComplete: boolean;
  onComplete: () => void;
  prefix?: ReactNode;
  onProgress?: (cursor: number) => void;
  className?: string;
  showCursor?: boolean;
}

const defaultDuration = 70;

const clampMs = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getSpeechDelayMs = (baseMs: number, lastChar: string | undefined) => {
  const base = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : defaultDuration;
  const jitter = Math.round((Math.random() * 0.3 - 0.12) * base);

  if (!lastChar) return clampMs(base + jitter, 10, 220);

  if (lastChar === ' ') return clampMs(Math.round(base * 0.35) + jitter, 10, 140);
  if (lastChar === '\n') return clampMs(Math.round(base * 1.2) + jitter, 10, 260);

  if (/[.?!]/.test(lastChar)) return clampMs(Math.round(base * 4.2) + jitter, 40, 520);
  if (/[,]/.test(lastChar)) return clampMs(Math.round(base * 2.0) + jitter, 20, 360);
  if (/[;:]/.test(lastChar)) return clampMs(Math.round(base * 2.4) + jitter, 20, 380);
  if (/[”"']/u.test(lastChar)) return clampMs(Math.round(base * 0.75) + jitter, 10, 240);
  if (/[…]/u.test(lastChar)) return clampMs(Math.round(base * 3.0) + jitter, 30, 520);

  return clampMs(base + jitter, 10, 260);
};

const Sentence = ({
  assets,
  data,
  direct,
  isComplete: isCompleteProp,
  onComplete,
  prefix,
  onProgress,
  className,
  showCursor = true,
}: SentenceProps) => {
  const [_sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [_cursor, setCursor] = useState<number>(0);
  // Preload image assets to ensure quick display even for short dialogues
  const [preloadedImages, setPreloadedImages] = useState<Record<string, boolean>>({});
  const [_step, setStep] = useState<number>(-1);

  const step = Math.min(_step, _sentences.length);

  const isComplete = useMemo(() => {
    if (_sentences.length === 0) return false;
    return _step >= _sentences.length;
  }, [_sentences.length, _step]);

  const cursor = isCompleteProp || isComplete ? Number.POSITIVE_INFINITY : _cursor;

  const sentence = _sentences[step] ?? { message: '', duration: 0 };
  const baseDuration = sentence.duration ?? defaultDuration;

  const renderedSentence = useMemo<ReactNode>(() => {
    const nodes: ReactNode[] = [];

    for (let index = 0; index < _sentences.length; index += 1) {
      if (!isCompleteProp && step < index) break;

      const entry = _sentences[index];

      if (index > 0) nodes.push(' ');

      if (index < step) {
        nodes.push(entry.message);
        continue;
      }

      if (index === step) {
        const visible = entry.message.substring(0, cursor);
        if (!visible) continue;

        const prefix = visible.slice(0, -1);
        const last = visible.slice(-1);

        if (prefix) nodes.push(prefix);
        nodes.push(
          <span key={`pop-${index}-${visible.length}`} className="dialogue-pop">
            {last}
          </span>,
        );
        continue;
      }

      nodes.push(entry.message);
    }

    return <>{nodes}</>;
  }, [_sentences, cursor, isCompleteProp, step]);

  const assetArray = useMemo<AssetEntry[]>(() => {
    const entries = _sentences.flatMap((sentenceEntry, index) => {
      if (!sentenceEntry.asset) return [];
      const assetNames = Array.isArray(sentenceEntry.asset) ? sentenceEntry.asset : [sentenceEntry.asset];
      return assetNames.map((name, assetIndex) => ({ name, index, key: `${index}-${assetIndex}-${name}` }));
    });

    if (isCompleteProp) return entries;

    const currentIndex = Math.min(Math.max(step, 0), _sentences.length - 1);
    return entries.filter((entry) => entry.index === currentIndex);
  }, [_sentences, step, isCompleteProp]);

  // Preload currently referenced asset images
  useEffect(() => {
    const toLoad = assetArray
      .map((a) => assets?.[a.name]?.image)
      .filter((src): src is string => typeof src === 'string');
    toLoad.forEach((src) => {
      if (preloadedImages[src]) return;
      const img = new Image();
      const onDone = () => setPreloadedImages((p) => ({ ...p, [src]: true }));
      img.onload = onDone;
      img.onerror = onDone;
      img.src = src;
    });
  }, [assetArray, assets, preloadedImages]);

  const isEndCursor = step < _sentences.length && sentence.message.length <= cursor;


  useEffect(() => {
    if (!data) {
      setSentences([]);
      setStep(-1);
      setCursor(0);
      return;
    }

    if (Array.isArray(data)) {
      setSentences(data);
    } else if (typeof data === 'object') {
      setSentences([data]);
    } else {
      setSentences([{ message: data, duration: defaultDuration }]);
    }

    setStep(0);
    setCursor(0);
    hasCalledComplete.current = false;
  }, [data]);

  const hasCalledComplete = useRef(false);

  useEffect(() => {
    if (step < 0) return;
    setCursor(0);
  }, [step]);

  useEffect(() => {
    if (isCompleteProp || isComplete) return;

    const message = sentence.message;
    if (!message) return;
    if (_cursor >= message.length) return;

    const lastChar = _cursor > 0 ? message[_cursor - 1] : undefined;
    const delayMs = getSpeechDelayMs(baseDuration, lastChar);

    const timeout = window.setTimeout(() => {
      // 타자 사운드 재생
      const typingSoundGenerator = getTypingSoundGenerator();
      typingSoundGenerator.playMechanicalKey();
      
      setCursor((prev) => prev + 1);
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [baseDuration, isComplete, isCompleteProp, _cursor, sentence.message]);

  useEffect(() => {
    onProgress?.(_cursor);
  }, [_cursor, onProgress]);


  useEffect(() => {
    if (!isEndCursor) return;
    setStep((prev) => (prev >= _sentences.length ? prev : prev + 1));
  }, [_sentences.length, isEndCursor]);

  useEffect(() => {
    if (isComplete && !isCompleteProp && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onComplete();
    }
  }, [isComplete, isCompleteProp, onComplete]);

  const [rootBounds, setRootBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;

    const update = () => {
      const rect = root.getBoundingClientRect();
      setRootBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  return (
    <>
      {assets && assetArray && (
        <>
          {assetArray.map(({ name, key }) => {
            const asset = assets[name];
            if (!asset?.audio) return null;
            return <audio key={`audio-${key}`} src={asset.audio} autoPlay />;
          })}

          {typeof document !== 'undefined' &&
            rootBounds &&
            createPortal(
              <div
                className="pointer-events-none"
                style={{
                  position: 'fixed',
                  left: rootBounds.left,
                  top: rootBounds.top,
                  width: rootBounds.width,
                  height: rootBounds.height,
                  zIndex: 9999,
                }}
              >
                <AnimatePresence initial={false}>
                  {assetArray.map(({ name, key }, index) => {
                    const asset = assets[name];
                    if (!asset?.image) return null;

                    const size = rootBounds.width < 520 ? 56 : 72;
                    const gap = 10;
                    const base = 18 + index * (size + gap);

                    const stickerStyle: CSSProperties = {
                      position: 'absolute',
                      bottom: 96,
                      width: size,
                      height: size,
                      left: direct ? undefined : base,
                      right: direct ? base : undefined,
                    };

                    return (
                      <motion.div
                        key={`sticker-${key}`}
                        style={stickerStyle}
                        initial={{ opacity: 0, scale: 0.85, y: 10, rotate: direct ? 2 : -2 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 8 }}
                        transition={{
                          opacity: { duration: 0.18, ease: 'easeOut' },
                          scale: { type: 'spring', stiffness: 260, damping: 18 },
                          y: { type: 'spring', stiffness: 240, damping: 20 },
                        }}
                      >
                        <div className="h-full w-full rounded-xl border border-white/10 bg-black/25 p-1 shadow-2xl shadow-black/60 backdrop-blur">
                          {preloadedImages[asset.image] ? (
                            <img className="h-full w-full object-contain" src={asset.image} alt="" />
                          ) : (
                            <div style={{ width: size, height: size, background: 'rgba(255,255,255,0.08)' }} />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>,
              document.body,
            )}
        </>
      )}
      <span className={`whitespace-pre-line leading-relaxed${className ? ` ${className}` : ''}`}>
        {prefix}
        {renderedSentence}
        {!isCompleteProp && !isComplete && showCursor && <span className="terminal-cursor has-prefix">▍</span>}
      </span>
    </>
  );
};

export default memo(Sentence);
