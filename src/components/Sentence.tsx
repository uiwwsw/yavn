// import reactLogo from './assets/react.svg';

import { useEffect, useMemo, useState } from 'react';

// import viteLogo from '/vite.svg';
interface Sentence {
  duration: number;
  message: string;
  sound?: string;
}
export interface SentenceProps {
  data?: string | Sentence | Sentence[];
  isComplete: boolean;
  onComplete: () => void;
}
const defaultDuration = 100;
const Sentence = ({ data, isComplete: isCompleteProp, onComplete }: SentenceProps) => {
  const [_sentences, setSentences] = useState<Sentence[]>([]);
  const [_cursor, setCursor] = useState<number>(0);
  const [_step, setStep] = useState<number>(-1);

  const step = useMemo(() => Math.min(_step, _sentences.length), [_step, _sentences]);

  const isComplete = useMemo(() => {
    if (_cursor === 0) return false;
    return _sentences.length <= _step;
  }, [_sentences, _step]);

  const cursor = useMemo(() => {
    return isCompleteProp || isComplete ? Infinity : _cursor;
  }, [_sentences, _cursor, isCompleteProp]);

  const sentence = useMemo(() => _sentences[step] ?? { message: '', duration: 0 }, [_sentences, step]);
  const sentences = useMemo(() => {
    let msg = '';
    for (const index in _sentences) {
      if (!isCompleteProp && step < +index) break;
      if (step === +index) msg = (msg ? `${msg} ` : '') + _sentences[index].message.substring(0, cursor);
      else msg = (msg ? `${msg} ` : '') + _sentences[index].message;
    }

    return msg;
  }, [_sentences, cursor, step, isCompleteProp]);
  const duration = useMemo(() => {
    return sentence.duration ?? defaultDuration;
  }, [_sentences, step]);
  const sound = useMemo(() => {
    return sentence.sound;
  }, [_sentences, step]);
  const isEndCursor = useMemo(() => {
    return sentence.message.length <= cursor;
  }, [_sentences, step, cursor]);
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
      {sound && <audio src={sound} autoPlay />}
      <p className="relative flex-auto">
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
