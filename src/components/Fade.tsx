import { motion, useReducedMotion } from 'framer-motion';
import { Children, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

interface FadeProps {
  children: ReactNode | ReactNode[];
  onComplete?: () => void;
  className?: string;
}

type Phase = 'enter' | 'stay' | 'exit' | 'change';

const phases: Phase[] = ['enter', 'stay', 'exit', 'change'];

const Fade = ({ children, onComplete, className }: FadeProps) => {
  const childArray = useMemo(() => Children.toArray(children), [children]);
  const length = childArray.length;
  const [step, setStep] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = phases[phaseIndex];
  const current = childArray[step] ?? null;
  const isLast = step >= length - 1;
  const prefersReducedMotion = useReducedMotion();

  const variants = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        enter: { opacity: 1, transition: { duration: 0.5, ease: 'easeInOut' } },
        stay: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.4, ease: 'easeInOut' } },
        change: { opacity: 0, transition: { duration: 0.1 } },
      } satisfies Record<Phase | 'initial', object>;
    }

    const shared = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

    return {
      initial: { opacity: 0, scale: 0.98 },
      enter: {
        opacity: 1,
        scale: 1,
        transition: shared,
      },
      stay: { opacity: 1, scale: 1 },
      exit: {
        opacity: 0,
        scale: 1.01,
        transition: shared,
      },
      change: {
        opacity: 0,
        scale: 0.98,
        transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
      },
    } satisfies Record<Phase | 'initial', object>;
  }, [prefersReducedMotion]);

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
