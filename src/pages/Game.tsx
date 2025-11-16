import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import Sentence, { SentenceProps } from '@/Sentence';
import { getJson } from '#/getJson';
import Preload from '@/Preload';
import { useStorageContext } from '@/StorageContext';
export interface Asset {
  image?: string;
  audio?: string;
}
export type Assets = {
  [key: string]: Asset;
};
interface ChoiceDestination {
  chapter?: number;
  sentence?: number;
  id?: string;
}
interface ChoiceOption {
  text: string;
  goTo?: ChoiceDestination;
}
interface ChoiceNode {
  prompt?: string;
  choices: ChoiceOption[];
}
type ChapterSentence = SentenceProps['data'] | ChoiceNode;
const isChoiceNode = (value: ChapterSentence | undefined): value is ChoiceNode => {
  if (!value) return false;
  if (typeof value !== 'object') return false;
  return 'choices' in value && Array.isArray((value as ChoiceNode).choices);
};
interface Chapter {
  id?: string;
  changePosition?: true;
  sentences: ChapterSentence[];
  character: string;
  place: string;
  next?: ChoiceDestination;
}
const Game = () => {
  const { level, addStorage } = useStorageContext();

  const [direct, setDirect] = useState<boolean>();
  const [assets, setAssets] = useState<Assets>({});
  const [step, setStep] = useState([0, 0]);
  const [chapter, setChapter] = useState<Chapter[]>([]);
  const [complete, setComplete] = useState(false);
  const [auto, setAuto] = useState(false);
  const [activeChoice, setActiveChoice] = useState<ChoiceNode | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [displayCharacter, setDisplayCharacter] = useState<string>();
  const [characterImage, setCharacterImage] = useState<string>();
  const [autoProgress, setAutoProgress] = useState(0);
  const assetList = useMemo(
    () => Object.values(assets).flatMap((x) => Object.values(x).filter((x) => x) as string[]),
    [assets],
  );
  const scene = useMemo(() => (chapter.length ? chapter[step[0]] : null), [chapter, step]);
  const character = useMemo(() => scene?.character, [scene]);
  const changePosition = useMemo(() => scene?.changePosition, [scene]);
  const place = useMemo(() => scene?.place, [scene]);
  const sentence = useMemo(() => scene?.sentences?.[step[1]], [scene, step]);
  const sentenceData = useMemo<SentenceProps['data'] | undefined>(() => {
    if (!sentence || isChoiceNode(sentence)) return undefined;
    return sentence;
  }, [sentence]);
  const maxSentence = useMemo(() => scene?.sentences.length ?? 0, [scene]);
  const maxStep = useMemo(() => chapter.length, [chapter]);
  const sceneNext = useMemo(() => scene?.next, [scene]);
  const characterPosition: CSSProperties = useMemo(() => {
    type HorizontalSide = 'left' | 'right';
    const activeSide: HorizontalSide = direct ? 'right' : 'left';
    const inactiveSide: HorizontalSide = direct ? 'left' : 'right';

    return {
      [activeSide]: 0,
      [inactiveSide]: 'auto',
    } as CSSProperties;
  }, [direct]);
  const sentencePosition: CSSProperties = useMemo(
    () => (direct ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }),
    [direct],
  );
  const handleGoSavePage = useCallback(() => addStorage({ page: 'save', level }), [addStorage, level]);

  const handleComplete = useCallback(() => {
    setComplete(true);
    setCompletedAt(Date.now());
  }, []);
  const onChangePosition = () => {
    setDirect((prev) => {
      if (prev === undefined) return false;
      if (changePosition) return prev;
      return !prev;
    });
  };

  const resolveDestination = useCallback(
    (destination?: ChoiceDestination): [number, number] | null => {
      if (!destination) return null;

      let chapterIndex: number | undefined;
      if (destination.id) {
        chapterIndex = chapter.findIndex((item) => item.id === destination.id);
        if (chapterIndex === -1) return null;
      } else if (destination.chapter !== undefined) {
        chapterIndex = destination.chapter;
      } else {
        chapterIndex = step[0];
      }

      if (chapterIndex < 0 || chapterIndex >= chapter.length) return null;

      const targetScene = chapter[chapterIndex];
      const maxSentences = targetScene?.sentences?.length ?? 0;
      if (!maxSentences) return null;

      const sentenceIndex = destination.sentence ?? 0;
      const clampedSentence = Math.max(0, Math.min(sentenceIndex, maxSentences - 1));

      return [chapterIndex, clampedSentence];
    },
    [chapter, step],
  );

  const advanceToNext = useCallback(() => {
    let nextSentence = step[1] + 1;
    let nextStep = step[0];

    if (nextSentence >= maxSentence) {
      nextSentence = 0;

      if (sceneNext) {
        const target = resolveDestination(sceneNext);
        if (target) {
          setStep(target);
          return;
        }
      }

      nextStep += 1;
    }

    if (nextStep >= maxStep) {
      handleGoSavePage();
      return;
    }

    setStep([nextStep, nextSentence]);
  }, [handleGoSavePage, maxSentence, maxStep, resolveDestination, sceneNext, step]);

  const nextScene = useCallback(() => {
    if (activeChoice) return;
    if (!complete) return handleComplete();
    setAutoProgress(0);
    setComplete(false);
    setCompletedAt(null);
    advanceToNext();
  }, [activeChoice, advanceToNext, complete, handleComplete]);

  const handleChoiceSelect = useCallback(
    (option: ChoiceOption) => {
      setActiveChoice(null);
      setComplete(false);
      setCompletedAt(null);
      setAutoProgress(0);
      const target = resolveDestination(option.goTo);
      if (target) {
        setStep(target);
        return;
      }
      advanceToNext();
    },
    [advanceToNext, resolveDestination],
  );

  const handleEnter = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Enter') nextScene();
    },
    [nextScene],
  );
  useEffect(() => {
    character && onChangePosition();
  }, [character, changePosition]);
  useEffect(() => {
    if (!character) {
      setDisplayCharacter(undefined);
      setCharacterImage(undefined);
      return;
    }
    const src = assets[character]?.image;
    if (!src) {
      setDisplayCharacter(undefined);
      setCharacterImage(undefined);
      return;
    }
    if (displayCharacter === character && characterImage === src) return;
    let canceled = false;
    setDisplayCharacter(undefined);
    setCharacterImage(undefined);
    const img = new Image();
    img.src = src;
    const handleLoad = () => {
      if (canceled) return;
      setDisplayCharacter(character);
      setCharacterImage(src);
    };
    if (img.complete) handleLoad();
    else img.addEventListener('load', handleLoad, { once: true });
    return () => {
      canceled = true;
      img.removeEventListener('load', handleLoad);
    };
  }, [assets, character, characterImage, displayCharacter]);
  useEffect(() => {
    Promise.all([getJson<Chapter[]>(`chapter${level}`), getJson<Assets>(`assets${level}`)])
      .then(([c, a]) => {
        setChapter(c);
        setAssets(a);
        setStep([0, 0]);
        setComplete(false);
        setCompletedAt(null);
        setActiveChoice(null);
        setAutoProgress(0);
      })
      .catch(() => {
        addStorage({ page: 'credit', level: 0 });
      });
  }, [level, addStorage]);
  useEffect(() => {
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [handleEnter]);

  useEffect(() => {
    if (isChoiceNode(sentence)) {
      setActiveChoice(sentence);
      return;
    }
    setActiveChoice(null);
  }, [sentence]);

  const autoAdvanceDelay = useMemo(() => 1000, []);

  useEffect(() => {
    if (!auto) return;
    if (!complete || activeChoice) return;
    setAutoProgress(0);
    setCompletedAt(Date.now());
  }, [auto, complete, activeChoice]);

  useEffect(() => {
    if (!auto || !complete || activeChoice || !completedAt) {
      setAutoProgress(0);
      return;
    }

    let animationFrame: number;
    const start = completedAt;
    setAutoProgress(0);

    const update = () => {
      const elapsed = Date.now() - start;
      const progress = autoAdvanceDelay <= 0 ? 1 : Math.min(1, elapsed / autoAdvanceDelay);
      setAutoProgress(progress);

      if (progress >= 1) {
        nextScene();
        return;
      }

      animationFrame = window.requestAnimationFrame(update);
    };

    animationFrame = window.requestAnimationFrame(update);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [auto, complete, activeChoice, completedAt, autoAdvanceDelay, nextScene]);

  return (
    <Preload assets={assetList}>
      <div onClick={nextScene} className="absolute inset-0">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-start p-4">
          <label
            className="pointer-events-auto flex items-center gap-2 rounded bg-white/80 px-3 py-1 text-sm font-semibold text-black shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            자동
          </label>
        </div>
        {place && assets[place]?.audio && <audio src={assets[place]?.audio} autoPlay />}
        {displayCharacter && characterImage && (
          <img
            className="absolute bottom-0 z-10 w-1/2"
            style={characterPosition}
            src={characterImage}
            alt={displayCharacter}
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
            <span className="whitespace-nowrap">{character}</span>
            {sentenceData && (
              <Sentence
                assets={assets}
                data={sentenceData}
                direct={direct}
                isComplete={complete}
                auto={auto}
                autoProgress={autoProgress}
                onComplete={handleComplete}
              />
            )}
            {activeChoice && (
              <div className="flex flex-1 flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                {activeChoice.prompt && <p className="whitespace-pre-line">{activeChoice.prompt}</p>}
                <div className="flex flex-col gap-2">
                  {activeChoice.choices.map((choice, index) => (
                    <button
                      key={`${choice.text}-${index}`}
                      className="rounded border border-black bg-white/90 px-3 py-2 text-left font-medium hover:bg-black hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChoiceSelect(choice);
                      }}
                    >
                      {choice.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Preload>
  );
};

export default Game;
