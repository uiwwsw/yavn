import { motion } from 'framer-motion';
import { Children, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

interface FadeProps {
  children: ReactNode | ReactNode[];
  onComplete?: () => void;
  className?: string;
}

type Phase = 'enter' | 'stay' | 'exit' | 'change';

const phases: Phase[] = ['enter', 'stay', 'exit', 'change'];

const variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 1 } },
  stay: { opacity: 1, transition: { duration: 1 } },
  exit: { opacity: 0, transition: { duration: 1 } },
  change: { opacity: 0, transition: { duration: 0.01 } },
};

const Fade = ({ children, onComplete, className }: FadeProps) => {
  const childArray = useMemo(() => Children.toArray(children), [children]);
  const length = childArray.length;
  const [step, setStep] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = phases[phaseIndex];
  const current = childArray[step] ?? null;
  const isLast = step >= length - 1;

  useEffect(() => {
    setStep(0);
    setPhaseIndex(0);
  }, [length]);

  const handlePhaseAdvance = useCallback(() => {
    setPhaseIndex((prev) => (prev + 1) % phases.length);
  }, []);

  const handleChangeComplete = useCallback(() => {
    if (length === 0) return;
    if (isLast) {
      onComplete?.();
      return;
    }
    setStep((prev) => Math.min(prev + 1, length - 1));
    setPhaseIndex(0);
  }, [isLast, length, onComplete]);

  const handleAnimationComplete = useCallback(
    (definition: Phase | string) => {
      if (definition === 'change') {
        handleChangeComplete();
        return;
      }
      handlePhaseAdvance();
    },
    [handleChangeComplete, handlePhaseAdvance],
  );

  const handleClick = useCallback(() => {
    if (phase === 'change') {
      handleChangeComplete();
      return;
    }
    handlePhaseAdvance();
  }, [handleChangeComplete, handlePhaseAdvance, phase]);

  useEffect(() => {
    window.addEventListener('keydown', handleClick);
    return () => window.removeEventListener('keydown', handleClick);
  }, [handleClick]);

  if (length === 0) return null;

  return (
    <motion.div
      className={`fade${className ? ` ${className}` : ''}`}
      initial="initial"
      animate={phase}
      variants={variants}
      onAnimationComplete={handleAnimationComplete}
      onClick={handleClick}
    >
      {current}
    </motion.div>
  );
};

export default Fade;
