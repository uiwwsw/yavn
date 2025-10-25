// import reactLogo from './assets/react.svg';
import { AnimatePresence, motion } from 'framer-motion';
import { Assets } from '@/Game';
import { useCallback, useEffect, useMemo, useState } from 'react';

// import viteLogo from '/vite.svg';
interface Sentence {
  duration: number;
  message: string;
  asset?: string;
}
export interface SentenceProps {
  assets?: Assets;
  data?: string | Sentence | Sentence[];
  isComplete: boolean;
  onComplete: () => void;
}
const defaultDuration = 100;
const Sentence = ({ assets, data, isComplete: isCompleteProp, onComplete }: SentenceProps) => {
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
  const assetArray = useMemo(() => {
    if (isCompleteProp) return _sentences.map((x) => x.asset).filter((x) => x) as string[];
    let array = [];
    for (const index in _sentences) {
      if (!isCompleteProp && step < +index) break;
      if (step >= +index) array.push(_sentences[index].asset);
    }

    return array.filter((x) => x) as string[];
  }, [_sentences, step, isCompleteProp]);
  const isEndCursor = useMemo(() => sentence.message.length <= cursor, [_sentences, step, cursor]);
  const marginLeft = useCallback(
    (index: number, arr: string[]) => {
      if (!assets) return 0;
      const audioLength = arr.slice(index, step).filter((x) => assets[x].audio).length;
      return (index - arr.length + 1 + audioLength) * -100;
    },
    [assets],
  );
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
          {assetArray.map((x, i) => {
            const asset = assets[x];
            if (!asset?.audio) return null;
            return <audio key={`audio-${x}-${i}`} src={asset.audio} autoPlay />;
          })}
          <AnimatePresence initial={false}>
            {assetArray.map((x, i, arr) => {
              const asset = assets[x];
              if (!asset?.image) return null;
              const offset = marginLeft(i, arr);
              return (
                <motion.img
                  key={`image-${x}-${i}`}
                  className="fixed left-1/2 top-1/2 max-h-40 max-w-40 -translate-x-1/2 -translate-y-1/2 object-contain"
                  src={asset.image}
                  alt=""
                  initial={{ opacity: 0, scale: 0.95, x: offset - 12 }}
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
