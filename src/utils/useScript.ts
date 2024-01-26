import { Character } from '!/character/domain';
import { Place } from '!/place/domain';
import { SessionStorage } from '@/StorageContext';
import { useEffect, useMemo, useState } from 'react';
interface UseScriptProps {
  level: number;
  onComplete: () => void;
}
interface Script {
  message: string;
}
interface Chapter {
  image: string;
  scripts: Script[];
  character: Character;
  place: Place;
}
const useScript = ({ level, onComplete }: UseScriptProps) => {
  const [step, setStep] = useState([0, 0]);
  const [chapter, setChapter] = useState<Chapter[]>([]);
  const scene = useMemo(() => chapter[step[0]], [chapter, step]);
  const character = useMemo(() => scene.character, [scene]);
  const place = useMemo(() => scene.place, [scene]);
  const image = useMemo(() => scene.image, [scene]);
  const script = useMemo(() => scene.scripts[step[1]], [scene, step]);
  const maxSentence = useMemo(() => scene.scripts.length, [scene, step]);
  const nextScene = () => {
    let nextSentence = step[1] + 1;
    let nextStep = step[0] + 1;

    if (nextSentence >= maxSentence) {
      nextSentence = 0;
      nextStep += 1;
    }
    if (nextStep >= maxSentence) return onComplete();

    setStep([nextStep, nextSentence]);
    // onComplete
    // setStep()
  };
  useEffect(() => {
    async () => {
      const res = await fetch(`/chapter${level}.json`);
      setChapter(await res.json());
    };
  }, [level]);
  return { character, place, image, script, nextScene };
};

export default useScript;
