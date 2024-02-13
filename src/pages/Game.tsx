import { CSSProperties, useEffect, useMemo, useState } from 'react';
import Sentence, { SentenceProps } from '@/Sentence';
import { getJson } from '#/getJson';
import useDebounce from '#/useDebounce';
import Preload from '@/Preload';
import { useStorageContext } from '@/StorageContext';
export interface Asset {
  image?: string;
  audio?: string;
}
export type Assets = {
  [key: string]: Asset;
};
interface Chapter {
  changePosition?: true;
  sentences: SentenceProps['data'][];
  character: string;
  place: string;
}
const Game = () => {
  const { level, addStorage } = useStorageContext();

  const [direct, setDirect] = useState<boolean>();
  const [assets, setAssets] = useState<Assets>({});
  const [step, setStep] = useState([0, 0]);
  const [chapter, setChapter] = useState<Chapter[]>([]);
  const [complete, setComplete] = useState(false);
  const assetList = useMemo(
    () => Object.values(assets).flatMap((x) => Object.values(x).filter((x) => x) as string[]),
    [assets],
  );
  const scene = useMemo(() => (chapter.length ? chapter[step[0]] : null), [chapter, step]);
  const character = useMemo(() => scene?.character, [scene]);
  const changePosition = useMemo(() => scene?.changePosition, [scene]);
  const place = useMemo(() => scene?.place, [scene]);
  const sentence = useMemo(() => scene?.sentences?.[step[1]], [scene, step]);
  const maxSentence = useMemo(() => scene?.sentences.length ?? 0, [scene, step]);
  const maxStep = useMemo(() => chapter.length, [chapter]);
  const characterPosition: CSSProperties = useMemo(() => (direct ? { right: 0 } : { left: 0 }), [direct]);
  const sentencePosition: CSSProperties = useMemo(
    () => (direct ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }),
    [direct],
  );
  const handleGoSavePage = () => addStorage({ page: 'save', level });

  const handleComplete = () => {
    setComplete(true);
  };
  const onChangePosition = useDebounce(() => {
    setDirect((prev) => {
      if (prev === undefined) return false;
      const res = !prev;
      if (changePosition) return !res;
      return res;
    });
  });
  const nextScene = () => {
    if (!complete) return handleComplete();
    setComplete(false);
    let nextSentence = step[1] + 1;
    let nextStep = step[0];

    if (nextSentence >= maxSentence) {
      nextSentence = 0;
      nextStep += 1;
    }
    if (nextStep >= maxStep) return handleGoSavePage();

    setStep([nextStep, nextSentence]);
    // onComplete
    // setStep()
  };
  useEffect(() => {
    character && onChangePosition();
  }, [character, changePosition]);
  useEffect(() => {
    Promise.all([getJson<Chapter[]>(`chapter${level}`), getJson<Assets>(`assets${level}`)])
      .then(([c, a]) => {
        setChapter(c);
        setAssets(a);
      })
      .catch(() => {
        addStorage({ page: 'credit', level: 0 });
      });
  }, [level]);
  // return { character, place, image, Scene, nextScene };
  return (
    <Preload assets={assetList}>
      <div onClick={nextScene} className="absolute inset-0">
        {place && assets[place]?.audio && <audio src={assets[place]?.audio} autoPlay />}
        {character && (
          <img
            className="absolute bottom-0 z-10 w-1/2"
            style={characterPosition}
            src={assets[character]?.image}
            alt={character}
          />
        )}
        {place && assets[place]?.image && (
          <img className="absolute h-full w-full object-cover" src={assets[place]?.image} alt={place} />
        )}
        {sentence && (
          <div
            className="absolute inset-0 top-auto z-20 flex gap-2 border-t bg-white bg-opacity-75 p-2 text-black"
            style={sentencePosition}
          >
            <span>{character}</span>
            <Sentence assets={assets} data={sentence} isComplete={complete} onComplete={handleComplete} />
          </div>
        )}
      </div>
    </Preload>
  );
};

export default Game;
