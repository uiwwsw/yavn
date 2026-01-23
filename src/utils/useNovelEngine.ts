import { CSSProperties, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { getJson } from '#/getJson';
import {
  Assets,
  BattleConfig,
  Chapter,
  ChoiceDestination,
  ChoiceNode,
  ChoiceOption,
  ChapterSentence,
  SentenceData,
  isChoiceNode,
} from '#/novelTypes';

interface UseNovelEngineOptions {
  level?: number;
  autoAdvanceDelay?: number;
  onChapterEnd: () => void;
  onLoadError: () => void;
}

interface SceneState {
  scene: Chapter | null;
  sentence: ChapterSentence | undefined;
  sentenceData: SentenceData | undefined;
  character: string | undefined;
  place: string | undefined;
  changePosition: true | undefined;
  next: ChoiceDestination | undefined;
  maxSentence: number;
  maxStep: number;
  battle: BattleConfig | undefined;
}

const useNovelEngine = ({
  level = 0,
  autoAdvanceDelay = 1000,
  onChapterEnd,
  onLoadError,
}: UseNovelEngineOptions) => {
  const [assets, setAssets] = useState<Assets>({});
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [step, setStep] = useState<[number, number]>([0, 0]);
  const [direct, setDirect] = useState<boolean>();
  const [complete, setComplete] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);
  const [activeChoice, setActiveChoice] = useState<ChoiceNode | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [displayCharacter, setDisplayCharacter] = useState<string>();
  const [characterImage, setCharacterImage] = useState<string>();

  const loadCancelledRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const initializationRef = useRef<number | null>(null);

  const [chapterIndex, sentenceIndex] = step;

  const sceneState = useMemo<SceneState>(() => {
    const scene = chapters[chapterIndex] ?? null;
    const sentence = scene?.sentences?.[sentenceIndex];
    const sentenceData = isChoiceNode(sentence) ? undefined : (sentence as SentenceData | undefined);
    const battle = scene?.battle;
    return {
      scene,
      sentence,
      sentenceData,
      character: scene?.character,
      place: scene?.place,
      changePosition: scene?.changePosition,
      next: scene?.next,
      maxSentence: scene?.sentences?.length ?? 0,
      maxStep: chapters.length,
      battle,
    };
  }, [chapters, chapterIndex, sentenceIndex]);

  const { sentence, sentenceData, character, place: scenePlace, changePosition, next, maxSentence, maxStep, battle } = sceneState;

  const [place, setPlace] = useState<string>();

  useEffect(() => {
    if (scenePlace) setPlace(scenePlace);
  }, [scenePlace]);

  const assetList = useMemo(
    () => Object.values(assets).flatMap((x) => Object.values(x).filter((item) => Boolean(item)) as string[]),
    [assets],
  );

  const characterPosition = useMemo(() => {
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

  const resetSceneProgress = useCallback(() => {
    setComplete(false);
    setCompletedAt(null);
    setAutoProgress(0);
  }, []);

  const handleComplete = useCallback(() => {
    setComplete(true);
    setCompletedAt(Date.now());
  }, []);

  const resolveDestination = useCallback(
    (destination?: ChoiceDestination): [number, number] | null => {
      if (!destination) return null;

      let chapterIndex: number | undefined;
      if (destination.id) {
        chapterIndex = chapters.findIndex((item) => item.id === destination.id);
        if (chapterIndex === -1) return null;
      } else if (destination.chapter !== undefined) {
        chapterIndex = destination.chapter;
      } else {
        chapterIndex = step[0];
      }

      if (chapterIndex < 0 || chapterIndex >= chapters.length) return null;

      const targetScene = chapters[chapterIndex];
      const maxSentences = targetScene?.sentences?.length ?? 0;
      if (!maxSentences) return null;

      const sentenceIndex = destination.sentence ?? 0;
      const clampedSentence = Math.max(0, Math.min(sentenceIndex, maxSentences - 1));

      return [chapterIndex, clampedSentence];
    },
    [chapters, step],
  );

  const goToStep = useCallback(
    (target: [number, number]) => {
      setStep(target);
      resetSceneProgress();
      setActiveChoice(null);
    },
    [resetSceneProgress],
  );

  const advanceToNext = useCallback(() => {
    let nextSentenceIndex = step[1] + 1;
    let nextChapterIndex = step[0];

    if (nextSentenceIndex >= maxSentence) {
      nextSentenceIndex = 0;

      if (next) {
        const target = resolveDestination(next);
        if (target) {
          goToStep(target);
          return;
        }
      }

      nextChapterIndex += 1;
    }

    if (nextChapterIndex >= maxStep) {
      onChapterEnd();
      return;
    }

    goToStep([nextChapterIndex, nextSentenceIndex]);
  }, [goToStep, maxSentence, maxStep, next, onChapterEnd, resolveDestination, step]);

  const nextScene = useCallback(() => {
    if (activeChoice) return;
    if (!complete) {
      handleComplete();
      return;
    }
    resetSceneProgress();
    advanceToNext();
  }, [activeChoice, advanceToNext, complete, handleComplete, resetSceneProgress]);

  const forceNextScene = useCallback(() => {
    resetSceneProgress();
    advanceToNext();
  }, [advanceToNext, resetSceneProgress]);

  const handleChoiceSelect = useCallback(
    (option: ChoiceOption) => {
      resetSceneProgress();
      const target = resolveDestination(option.goTo);
      if (target) {
        goToStep(target);
        return;
      }
      advanceToNext();
    },
    [advanceToNext, goToStep, resolveDestination, resetSceneProgress],
  );

  useEffect(() => {
    if (!character) return;
    setDirect((prev) => {
      if (prev === undefined) return false;
      if (changePosition) return prev;
      return !prev;
    });
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

    setDisplayCharacter(undefined);
    setCharacterImage(undefined);

    const img = new Image();
    img.src = src;
    const handleLoad = () => {
      if (loadCancelledRef.current) return;
      setDisplayCharacter(character);
      setCharacterImage(src);
    };

    if (img.complete) handleLoad();
    else img.addEventListener('load', handleLoad, { once: true });

    return () => {
      loadCancelledRef.current = true;
      img.removeEventListener('load', handleLoad);
      setTimeout(() => { loadCancelledRef.current = false; }, 0);
    };
  }, [assets, character, characterImage, displayCharacter]);

  useEffect(() => {
    const currentInit = Date.now();
    initializationRef.current = currentInit;
    
    loadCancelledRef.current = false;
    Promise.all([getJson<Chapter[]>(`chapter${level}`), getJson<Assets>(`assets${level}`)])
      .then(([chapterData, assetData]) => {
        if (loadCancelledRef.current || initializationRef.current !== currentInit) {
          return;
        }
        setChapters(chapterData);
        setAssets(assetData);
        setStep([0, 0]);
        setDirect(undefined);
        resetSceneProgress();
        setActiveChoice(null);
        setDisplayCharacter(undefined);
        setCharacterImage(undefined);
      })
      .catch(() => {
        if (!loadCancelledRef.current && initializationRef.current === currentInit) {
          onLoadError();
        }
      });

    return () => {
      loadCancelledRef.current = true;
      if (initializationRef.current === currentInit) {
        initializationRef.current = null;
      }
    };
  }, [level, onLoadError, resetSceneProgress]);

  useEffect(() => {
    if (isChoiceNode(sentence)) {
      setActiveChoice(sentence);
      return;
    }
    setActiveChoice(null);
  }, [sentence]);

  useEffect(() => {
    if (!auto) {
      setAutoProgress(0);
      return;
    }
    if (!complete || activeChoice) return;
    setAutoProgress(0);
    setCompletedAt(Date.now());
  }, [activeChoice, auto, complete]);

  useEffect(() => {
    if (!auto || !complete || activeChoice || !completedAt) {
      setAutoProgress(0);
      return;
    }

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

      animationFrameRef.current = window.requestAnimationFrame(update);
    };

    animationFrameRef.current = window.requestAnimationFrame(update);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeChoice, auto, autoAdvanceDelay, complete, completedAt, nextScene]);

  return {
    assets,
    assetList,
    auto,
    setAuto,
    autoProgress,
    character,
    characterImage,
    characterPosition,
    direct,
    displayCharacter,
    handleChoiceSelect,
    handleComplete,
    nextScene,
    place,
    sentence,
    sentenceData,
    sentencePosition,
    activeChoice,
    complete,
    battle,
    forceNextScene,
    step,
  };
};

export default useNovelEngine;
