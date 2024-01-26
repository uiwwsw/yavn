import { Character } from '!/character/domain';
import { Place } from '!/place/domain';
import { useEffect, useMemo, useState } from 'react';
interface ScriptProps {
  level: number;
  onComplete: () => void;
}
interface sentence {
  message: string;
}
interface Chapter {
  image: string;
  sentences: sentence[];
  character: Character;
  place: Place;
}
const Script = ({ level, onComplete }: ScriptProps) => {
  const [step, setStep] = useState([0, 0]);
  const [chapter, setChapter] = useState<Chapter[]>([]);
  const scene: Chapter | undefined = useMemo(() => chapter[step[0]], [chapter, step]);
  const character = useMemo(() => scene.character, [scene]);
  const place = useMemo(() => scene.place, [scene]);
  const image = useMemo(() => scene.image, [scene]);
  const sentence = useMemo(() => scene.sentences?.[step[1]], [scene, step]);
  const maxSentence = useMemo(() => scene.sentences.length, [scene, step]);
  const maxStep = useMemo(() => chapter.length, [chapter]);
  const nextScene = () => {
    let nextSentence = step[1] + 1;
    let nextStep = step[0];

    if (nextSentence >= maxSentence) {
      nextSentence = 0;
      nextStep += 1;
    }
    if (nextStep >= maxStep) return onComplete();

    setStep([nextStep, nextSentence]);
    // onComplete
    // setStep()
  };
  useEffect(() => {
    (async () => {
      const res = await fetch(`/chapter${level}.json`);
      console.log(res);
      setChapter(await res.json());
    })();
  }, [level]);
  // return { character, place, image, script, nextScene };
  return (
    <div onClick={nextScene} className="text-white">
      <span>{character}</span>
      <span>{image}</span>
      <span>{place}</span>
      <div>{sentence?.message}</div>
    </div>
  );
};

export default Script;
