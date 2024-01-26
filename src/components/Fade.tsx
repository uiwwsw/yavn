import { AnimationEvent, ReactNode, useMemo, useState } from 'react';

// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

interface FadeProps {
  children: ReactNode[];
  onComplete?: Function;
  className?: string;
}
type Animate = 'fade--in' | 'fade--stay' | 'fade--out' | 'fade--change';
const Fade = ({ children, onComplete, className: classNameProp }: FadeProps) => {
  const { length } = children;
  const [step, setStep] = useState(0);
  const current = children[step];
  const [animate, setAnimate] = useState(0);
  const className =
    useMemo((): Animate => {
      switch (animate) {
        default:
        case 0:
          return 'fade--in';
        case 1:
          return 'fade--stay';
        case 2:
          return 'fade--out';
        case 3:
          return 'fade--change';
      }
    }, [animate]) + `${classNameProp ? ` ${classNameProp}` : ''}`;
  const handleClick = () => setAnimate((prev) => (prev === 3 ? 0 : prev + 1));
  const handleEnd = (e: AnimationEvent) => {
    switch (e.animationName as Animate) {
      case 'fade--in':
      case 'fade--out':
      case 'fade--stay':
        handleClick();
        break;
      case 'fade--change':
        handleClick();
        if (step === length - 1) onComplete && onComplete();
        setStep(step + 1);
        break;
    }
  };
  //   const = { }
  return (
    <div className={`fade ${className}`} onAnimationEnd={handleEnd} onClick={handleClick}>
      {current}
    </div>
  );
};

export default Fade;
