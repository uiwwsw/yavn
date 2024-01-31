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
const Sentence = ({ data, isComplete: isCompleteProp, onComplete }: SentenceProps) => {
  const [_sentences, setSentences] = useState<Sentence[]>([]);
  const [_cursor, setCursor] = useState<number>(0);
  const [_step, setStep] = useState<number>(-1);

  const step = useMemo(() => Math.min(_step, _sentences.length - 1), [_step, _sentences]);

  const isComplete = useMemo(() => {
    return _sentences.length <= _step;
  }, [_sentences, _step, isCompleteProp]);

  const cursor = useMemo(
    () => (isCompleteProp || isComplete ? Infinity : _cursor),
    [_sentences, _step, _cursor, isCompleteProp],
  );

  const sentence = useMemo(() => _sentences[step] ?? { message: '', duration: 0 }, [_sentences, step]);
  const sentences = useMemo(() => {
    let msg = '';
    for (const index in _sentences) {
      if (step < +index) break;
      if (step === +index) msg += _sentences[index].message.substring(0, cursor);
      else msg += _sentences[index].message;
    }

    return msg;
  }, [_sentences, cursor, step]);
  const duration = useMemo(() => {
    return sentence.duration;
  }, [_sentences, step]);
  const sound = useMemo(() => {
    return sentence.sound;
  }, [_sentences, step]);
  const isEndCursor = useMemo(() => {
    return sentence.message.length + 1 <= cursor;
  }, [_sentences, step, cursor]);
  useEffect(() => {
    if (!data) return;

    if (data instanceof Array) setSentences(data);
    else if (data instanceof Object) setSentences([data]);
    else setSentences([{ message: data, duration: 300 }]);
    setStep(0);
  }, [data]);
  useEffect(() => {
    if (!duration || isComplete) return;
    setCursor(0);
    const sti = setInterval(() => setCursor((prev) => prev + 1), duration);
    return () => clearInterval(sti);
  }, [_sentences, step, isComplete]);

  useEffect(() => {
    if (isEndCursor) setStep((prev) => prev + 1);
  }, [isEndCursor]);
  useEffect(() => {
    if (isComplete) onComplete();
  }, [isComplete]);

  return (
    <>
      {sound && <audio src={sound} autoPlay />}
      <p className="flex flex-auto">
        {sentences}
        {isComplete ? (
          <span className="ml-auto w-fit animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
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
