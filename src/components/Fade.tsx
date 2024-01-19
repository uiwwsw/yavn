import { AnimationEvent, ReactNode, useMemo, useState } from 'react';

// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

interface FadeProps {
  children?: ReactNode[];
}
const Fade = ({ children }: FadeProps) => {
  const [step, setStep] = useState(children?.length ?? 0);
  const className = useMemo(() => {
    switch (step) {
      case 0:
        return 'fade--in';
      case 1:
        return 'fade--stay';
      case 2:
        return 'fade--out';
    }
  }, [step]);
  const handleEnd = (e: AnimationEvent) => {
    switch (e.animationName) {
      case 'fade-in':
        setStep(1);
        break;
      case 'fade-stay':
        setStep(2);
        break;
      case 'fade-out':
        setStep(0);
        break;
    }
  };
  //   const = { }
  return (
    <div className={`fade ${className}`} onAnimationEnd={handleEnd}>
      {children?.[0]}
    </div>
  );
};

export default Fade;
