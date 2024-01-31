import { CSSProperties, useEffect, useMemo, useState } from 'react';
import Sentence, { SentenceProps } from './Sentence';
import { getJson } from '#/getJson';
interface SceneProps {
  chapter: number;
  onComplete: () => void;
}
interface Asset {
  image: string;
  bgm?: string;
}
type Assets = {
  [key: string]: Asset;
};
interface Chapter {
  bgm?: string;
  changePosition?: true;
  sentences: SentenceProps['data'][];
  character: string;
  place: string;
}
const Scene = ({ chapter: level, onComplete }: SceneProps) => {
  const [direct, setDirect] = useState(false);
  const [assets, setAssets] = useState<Assets>({});
  const [step, setStep] = useState([0, 0]);
  const [chapter, setChapter] = useState<Chapter[]>([]);
  const [complete, setComplete] = useState(false);
  const scene = useMemo(() => (chapter.length ? chapter[step[0]] : null), [chapter, step]);
  const character = useMemo(() => scene?.character, [scene]);
  const bgm = useMemo(() => scene?.bgm, [scene]);
  const changePosition = useMemo(() => scene?.changePosition, [scene]);
  const place = useMemo(() => scene?.place, [scene]);
  const sentence = useMemo(() => scene?.sentences?.[step[1]], [scene, step]);
  const maxSentence = useMemo(() => scene?.sentences.length ?? 0, [scene, step]);
  const maxStep = useMemo(() => chapter.length, [chapter]);
  const characterPosition: CSSProperties = useMemo(() => (direct ? { left: 0 } : { right: 0 }), [direct]);
  const sentencePosition: CSSProperties = useMemo(
    () => (direct ? { flexDirection: 'row' } : { flexDirection: 'row-reverse' }),
    [direct],
  );
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
    setDirect((prev) => {
      const res = !prev;
      if (changePosition) return !res;
      return res;
    });
  }, [character, changePosition]);
  useEffect(() => {
    getJson(`chapter${level}`).then((x) => setChapter(x));
    getJson(`assets`).then((x) => setAssets(x));
  }, [level]);
  // return { character, place, image, Scene, nextScene };
  return (
    <div onClick={nextScene} className="absolute inset-0">
      <audio src={bgm} autoPlay />
      {character && (
        <img className="absolute z-10 w-1/2" style={characterPosition} src={assets[character]?.image} alt={character} />
      )}
      {place && <img className="absolute h-full w-full object-cover" src={assets[place]?.image} alt={place} />}
      <div className="absolute inset-0 top-auto flex gap-2 border-t p-2" style={sentencePosition}>
        <span>{character}</span>
        <Sentence data={sentence} isComplete={complete} onComplete={handleComplete} />
      </div>
    </div>
  );
};

export default Scene;
