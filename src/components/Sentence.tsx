// import reactLogo from './assets/react.svg';

import { useEffect, useMemo, useState } from 'react';

// import viteLogo from '/vite.svg';
interface Sentence {
  duration: number;
  message: string;
}
export interface SentenceProps {
  data?: string | Sentence | Sentence[];
  isComplete: boolean;
  onComplete: () => {};
}
const Sentence = ({ data, isComplete: isCompleteProp, onComplete }: SentenceProps) => {
  const [_sentences, setSentences] = useState<Sentence[]>([]);
  const [_cursor, setCursor] = useState<number>(0);
  const [_step, setStep] = useState<number>(-1);

  const step = useMemo(() => Math.min(_step, _sentences.length - 1), [_step, _sentences]);

  const isComplete = useMemo(() => {
    if (isCompleteProp) return true;
    return _sentences.length <= _step;
  }, [_sentences, _step, isCompleteProp]);
  const cursor = useMemo(() => (isComplete ? Infinity : _cursor), [_sentences, _step, _cursor]);

  const sentence = useMemo(() => {
    return _sentences[step] ?? { message: '', duration: 0 };
  }, [_sentences, step]);
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
    <p>
      {sentences}
      {isComplete ? (
        ''
      ) : (
        <span className="animate-ping" style={{ animationDuration: `${duration}ms` }}>
          |
        </span>
      )}
    </p>
  );
};

export default Sentence;
