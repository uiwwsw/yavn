// import reactLogo from './assets/react.svg';
import { AnimatePresence, motion } from 'framer-motion';
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { Assets, SentenceData, SentenceEntry } from '#/novelTypes';

// import viteLogo from '/vite.svg';
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
  auto?: boolean;
  autoProgress?: number;
  onComplete: () => void;
}
const defaultDuration = 70;
const Sentence = ({ assets, data, direct, isComplete: isCompleteProp, auto, autoProgress, onComplete }: SentenceProps) => {
  const [_sentences, setSentences] = useState<SentenceEntry[]>([]);
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
  const assetArray = useMemo<AssetEntry[]>(() => {
    const entries = _sentences.flatMap((sentence, index) => {
      if (!sentence.asset) return [];
      const assetNames = Array.isArray(sentence.asset) ? sentence.asset : [sentence.asset];
      return assetNames.map((name, assetIndex) => ({ name, index, key: `${index}-${assetIndex}-${name}` }));
    });

    if (isCompleteProp) return entries;

    const currentIndex = Math.min(Math.max(step, 0), _sentences.length - 1);
    return entries.filter((entry) => entry.index === currentIndex);
  }, [_sentences, step, isCompleteProp]);
  const isEndCursor = useMemo(() => sentence.message.length <= cursor, [_sentences, step, cursor]);
  const marginLeft = useCallback(
    (index: number, arr: AssetEntry[]) => {
      if (!assets) return 0;
      const audioLength = arr.slice(index).filter((entry) => assets[entry.name]?.audio).length;
      const baseOffset = (index - (arr.length - 1) + audioLength) * -100;
      return direct ? baseOffset * -1 : baseOffset;
    },
    [assets, direct],
  );
  useEffect(() => {
    if (!data) {
      setSentences([]);
      setStep(-1);
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
  const showAutoProgress = useMemo(() => Boolean(auto && isCompleteProp), [auto, isCompleteProp]);
  const clampedAutoProgress = useMemo(() => {
    if (!showAutoProgress) return 0;
    const value = typeof autoProgress === 'number' && Number.isFinite(autoProgress) ? autoProgress : 0;
    return Math.max(0, Math.min(1, value));
  }, [autoProgress, showAutoProgress]);

  const gaugeStyle = useMemo<CSSProperties | undefined>(() => {
    if (!showAutoProgress) return undefined;
    const percent = Math.round(clampedAutoProgress * 10000) / 100;
    return {
      background: `conic-gradient(rgba(0, 0, 0, 0.75) 0% ${percent}%, rgba(0, 0, 0, 0.15) ${percent}% 100%)`,
    };
  }, [clampedAutoProgress, showAutoProgress]);

  return (
    <>
      {assets && assetArray && (
        <>
          {assetArray.map(({ name, key }) => {
            const asset = assets[name];
            if (!asset?.audio) return null;
            return <audio key={`audio-${key}`} src={asset.audio} autoPlay />;
          })}
          <AnimatePresence initial={false}>
            {assetArray.map(({ name, key }, i, arr) => {
              const asset = assets[name];
              if (!asset?.image) return null;
              const offset = marginLeft(i, arr);
              const initialOffset = direct ? offset + 20 : offset - 20;
              return (
                <motion.img
                  key={`image-${key}`}
                  className={`fixed top-1/2 max-h-24 max-w-24 md:max-h-36 md:max-w-36 transform object-contain ${direct ? 'right-1/2' : 'left-1/2'}`}
                  src={asset.image}
                  alt=""
                  initial={{ opacity: 0, scale: 0.95, x: initialOffset }}
                  animate={{ opacity: 1, scale: 1, x: offset }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    opacity: { duration: 0.25, ease: 'easeOut' },
                    scale: { duration: 0.4, ease: 'easeOut' },
                    x: { type: 'spring', stiffness: 260, damping: 26 },
                  }}
                />
              );
            })}
          </AnimatePresence>
        </>
      )}
      <div className="relative flex flex-auto items-end gap-4">
        <span className="flex-1 whitespace-pre-line leading-relaxed">
          {sentences}
          {!isComplete && (
            <span className="ml-1 inline-block animate-ping align-baseline" style={{ animationDuration: `${duration}ms` }}>
              |
            </span>
          )}
        </span>
        <span
          className={`relative inline-flex h-10 w-10 items-center justify-center transition-opacity ${
            isCompleteProp ? 'opacity-100 animate-pulse' : 'opacity-60'
          }`}
        >
          {showAutoProgress && (
            <>
              <span className="absolute inset-0 rounded-full" style={gaugeStyle} />
              <span className="absolute inset-[3px] rounded-full bg-white/80" />
            </>
          )}
          {!showAutoProgress && (
            <span className="absolute inset-0 rounded-full bg-white/60" />
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="relative h-6 w-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
          </svg>
        </span>
      </div>
    </>
  );
};

export default Sentence;
