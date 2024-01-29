import { Character } from '!/character/domain';
import { Place } from '!/place/domain';
import { useEffect, useMemo, useState } from 'react';
import Sentence, { SentenceProps } from './Sentence';
interface SceneProps {
  chapter: number;
  onComplete: () => void;
}
interface Chapter {
  image: string;
  sentences: SentenceProps['data'][];
  character: Character;
  place: Place;
}
const Scene = ({ chapter: level, onComplete }: SceneProps) => {
  const [step, setStep] = useState([0, 0]);
  const [chapter, setChapter] = useState<Chapter[]>([]);
  const [complete, setComplete] = useState(false);
  const scene = useMemo(() => (chapter.length ? chapter[step[0]] : null), [chapter, step]);
  const character = useMemo(() => scene?.character, [scene]);
  const place = useMemo(() => scene?.place, [scene]);
  const image = useMemo(() => scene?.image, [scene]);
  const sentence = useMemo(() => scene?.sentences?.[step[1]], [scene, step]);
  const maxSentence = useMemo(() => scene?.sentences.length ?? 0, [scene, step]);
  const maxStep = useMemo(() => chapter.length, [chapter]);
  const handleComplete = () => setComplete(true);
  const nextScene = () => {
    if (!complete) return handleComplete();
    setComplete(false);
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
      setChapter(await res.json());
    })();
  }, [level]);
  // return { character, place, image, Scene, nextScene };
  return (
    <div onClick={nextScene} className="absolute inset-0">
      <span>{image}</span>
      {place ? <span>{place}</span> : null}
      <div className="absolute inset-0 top-auto flex gap-2 border-t p-2">
        <span>{character}</span>
        <Sentence data={sentence} isComplete={complete} onComplete={handleComplete} />
      </div>
    </div>
  );
};

export default Scene;
