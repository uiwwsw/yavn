import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Battle from '@/Battle';
import Preload from '@/Preload';
import SceneControls from '@/SceneControls';
import Sentence from '@/Sentence';
import { useStorageContext } from '@/useStorageContext';

import useNovelEngine from '#/useNovelEngine';
import type { ChoiceOption, SentenceData, SentenceEntry } from '#/novelTypes';

type ConsoleLine = {
  id: number;
  speaker: string;
  text: string;
};

const MAX_CONSOLE_LINES = 200;

const flattenSentenceData = (data: SentenceData): string => {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map((entry) => entry.message).join(' ');
  return (data as SentenceEntry).message;
};

const Game = () => {
  const { level, addStorage } = useStorageContext();
  const [passMode, setPassMode] = useState(false);


  const passChoiceTimeoutRef = useRef<number | null>(null);
  const handleGoSavePage = useCallback(() => addStorage({ page: 'save', level }), [addStorage, level]);
  const handleGoCreditPage = useCallback(() => addStorage({ page: 'credit', level: 0 }), [addStorage]);

  const {
    assets,
    assetList,
    auto,
    setAuto,
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
    activeChoice,
    complete,
    battle: battleConfig,
    forceNextScene,
    step,
  } = useNovelEngine({
    level,
    onChapterEnd: handleGoSavePage,
    onLoadError: handleGoCreditPage,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (assets && Object.keys(assets).length > 0) {
      setIsInitialized(true);
    } else {
      setIsInitialized(false);
    }
  }, [assets]);

  const consoleViewportRef = useRef<HTMLDivElement | null>(null);
  const isConsoleTypingRef = useRef(false);
  const userScrolledRef = useRef(false);

  const currentSentenceRef = useRef<unknown>(null);
  const lastSentenceLineRef = useRef<{ speaker: string; text: string } | null>(null);
  const nextConsoleIdRef = useRef(0);

  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [consoleTick, setConsoleTick] = useState(0);

  // Background Fade State
  const [displayPlace, setDisplayPlace] = useState(place);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (place === displayPlace) return;

    if (!isFading) {
      setIsFading(true);
      const timeout = setTimeout(() => {
        setDisplayPlace(place);
        // Break batching to ensure DOM updates with opacity-0 before fading in
        setTimeout(() => setIsFading(false), 50);
      }, 500); // Wait for fade out (or wait for initial load)
      return () => clearTimeout(timeout);
    }
  }, [place, displayPlace]);

  const scrollConsoleToBottom = useCallback(() => {
    const el = consoleViewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const appendConsoleLine = useCallback(
    (speaker: string, text: string) => {
      const trimmed = text.trimEnd();
      if (!trimmed) return;

      // 새 출력이 나오면(새 로그/선택) 다시 하단 고정으로 돌아간다.
      userScrolledRef.current = false;

      setConsoleLines((prev) => {
        const id = (nextConsoleIdRef.current += 1);
        const next = [...prev, { id, speaker, text: trimmed }];
        return next.length > MAX_CONSOLE_LINES ? next.slice(next.length - MAX_CONSOLE_LINES) : next;
      });
    },
    [],
  );

  useEffect(() => {
    setConsoleLines([]);
    currentSentenceRef.current = null;
    lastSentenceLineRef.current = null;
    nextConsoleIdRef.current = 0;
  }, [level, isInitialized]);

  const consoleSpeaker = character ?? 'SYSTEM';

  useEffect(() => {
    const typing = !battleConfig && Boolean(sentenceData) && !activeChoice && !complete;
    isConsoleTypingRef.current = typing;
    if (typing || activeChoice) {
      // 다음 글이 나오기 시작하거나(타이핑), 선택지가 열리면 하단 고정으로 복귀.
      userScrolledRef.current = false;
    }
  }, [activeChoice, battleConfig, complete, sentenceData]);

  useEffect(() => {
    if (battleConfig) return;
    if (!sentence) return;
    if (!isInitialized) return;

    if (currentSentenceRef.current !== sentence) {
      // 새 문장이 시작되면(타이핑 시작) 자동으로 하단 고정.
      userScrolledRef.current = false;

      if (currentSentenceRef.current !== null && lastSentenceLineRef.current) {
        appendConsoleLine(lastSentenceLineRef.current.speaker, lastSentenceLineRef.current.text);
      }

      currentSentenceRef.current = sentence;
      lastSentenceLineRef.current = sentenceData ? { speaker: consoleSpeaker, text: flattenSentenceData(sentenceData) } : null;
    }
  }, [appendConsoleLine, battleConfig, consoleSpeaker, sentence, sentenceData, isInitialized]);

  useEffect(() => {
    if (battleConfig) return;
    if (!consoleViewportRef.current) return;

    // 글이 나오는 중(타이핑)에는 항상 하단 고정.
    // 멈춰있을 때는 유저가 스크롤한 경우에만 유지.
    if (isConsoleTypingRef.current || !userScrolledRef.current) {
      window.requestAnimationFrame(() => {
        scrollConsoleToBottom();
      });
    }
  }, [activeChoice, battleConfig, complete, consoleLines.length, consoleTick, scrollConsoleToBottom]);

  const handleConsoleProgress = useCallback(() => setConsoleTick((prev) => prev + 1), []);

  const handleConsoleChoiceSelect = useCallback(
    (choice: ChoiceOption) => {
      if (passChoiceTimeoutRef.current) {
        window.clearTimeout(passChoiceTimeoutRef.current);
        passChoiceTimeoutRef.current = null;
      }

      appendConsoleLine('매튜', choice.text);
      handleChoiceSelect(choice);
    },
    [appendConsoleLine, handleChoiceSelect],
  );



  const handleBattleComplete = useCallback(
    (result: 'win' | 'lose') => {
      if (result === 'win') {
        forceNextScene();
        return;
      }
      addStorage({ page: 'gameOver', level: level ?? 0 });
    },
    [addStorage, forceNextScene, level],
  );

  const handleExitToTitle = useCallback(() => addStorage({ page: 'startMenu', level: 0 }), [addStorage]);

  const handleBackgroundClick = useCallback(() => {
    if (battleConfig) return;
    nextScene();
  }, [battleConfig, nextScene]);

  /* Sequential Choice Logic */
  const [choiceStage, setChoiceStage] = useState(0);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setChoiceStage(0);
    setSelectedChoiceIndex(null);
    setShake(false);
  }, [activeChoice]);

  // If there is NO prompt, we normally start showing choices immediately?
  // Let's assume stage 0 = prompt (if any), stage 1 = choice 0, stage 2 = choice 1...
  // If prompt is missing, we might need auto-advance or just treat stage 0 as "start"
  useEffect(() => {
    if (activeChoice && !activeChoice.prompt && choiceStage === 0) {
      setChoiceStage(1);
    }
  }, [activeChoice, choiceStage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (battleConfig) return;

      // Handle Enter
      if (e.code === 'Enter') {
        if (activeChoice) {
          if (selectedChoiceIndex !== null && activeChoice.choices[selectedChoiceIndex]) {
            handleConsoleChoiceSelect(activeChoice.choices[selectedChoiceIndex]);
          } else {
            setShake(true);
            setTimeout(() => setShake(false), 400);
          }
          return;
        }
        nextScene();
        return;
      }

      // Handle Number Keys for Choices
      if (activeChoice) {
        const key = e.key;
        const num = parseInt(key, 10);
        if (!isNaN(num)) {
          if (num >= 1 && num <= activeChoice.choices.length) {
            setSelectedChoiceIndex(num - 1);
          } else {
            setShake(true);
            setTimeout(() => setShake(false), 400);
            setSelectedChoiceIndex(null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChoice, battleConfig, handleConsoleChoiceSelect, nextScene, selectedChoiceIndex]);

  const consolePrefix = useMemo(
    () => (
      <>
        <span className="text-emerald-300">&gt;</span>{' '}
        <span className="text-white/70">{consoleSpeaker}</span>
        <span className="text-white/40">:</span>{' '}
      </>
    ),
    [consoleSpeaker],
  );

  const consoleDockClass = useMemo(() => {
    return direct ? 'justify-start' : 'justify-end';
  }, [direct]);

  const consoleHeightClass = useMemo(() => {
    // 기본은 3줄 정도 보이게
    return activeChoice ? 'h-[clamp(160px,36vh,220px)]' : 'h-[118px]';
  }, [activeChoice]);

  return (
    <Preload assets={assetList}>
      {battleConfig ? (
        <Battle
          config={battleConfig}
          auto={auto}
          onAutoChange={setAuto}
          pass={passMode}
          onPassChange={setPassMode}
          onComplete={handleBattleComplete}
          onExitToTitle={handleExitToTitle}
        />
      ) : (
        <div onClick={handleBackgroundClick} className="absolute inset-0">
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-start p-2 sm:p-4">
            <div onClick={(e) => e.stopPropagation()}>
              <SceneControls auto={auto} onAutoChange={setAuto} pass={passMode} onPassChange={setPassMode} />
            </div>
          </div>
          {place && assets[place]?.audio && <audio src={assets[place]?.audio} autoPlay />}
          {displayCharacter && characterImage && (
            <img className="absolute bottom-0 z-10 w-1/2" style={characterPosition} src={characterImage} alt={displayCharacter} />
          )}
          {displayPlace && assets[displayPlace]?.image && (
            <img
              className={`absolute h-full w-full object-cover transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}
              src={assets[displayPlace]?.image}
              alt={displayPlace}
            />
          )}
          {sentence && (
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex ${consoleDockClass} px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:px-3 sm:pb-2`}>
              <div className={`pointer-events-auto flex ${consoleHeightClass} w-full flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b0b0b]/60 shadow-2xl backdrop-blur-md`}>
                <div className="flex items-center justify-between border-b border-white/10 bg-[#1e1e1e]/80 px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                    <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                    <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="text-[12px] text-white/70">Console</div>
                  <div className="w-12" />
                </div>

                <div className="flex flex-1 flex-col overflow-hidden px-3 py-1 font-mono text-[12px] leading-[1.6] text-white/90">
                  <div
                    ref={consoleViewportRef}
                    onScroll={(e) => {
                      const el = e.currentTarget;

                      if (isConsoleTypingRef.current) {
                        el.scrollTop = el.scrollHeight;
                        return;
                      }

                      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                      userScrolledRef.current = !nearBottom;
                    }}
                    className="hide-scrollbar flex-1 overflow-y-auto overflow-x-hidden pr-1"
                  >
                    <div className="space-y-1">
                      {consoleLines.map((line) => (
                        <div key={line.id} className="whitespace-pre-wrap break-words">
                          <span className="text-emerald-300">&gt;</span>{' '}
                          <span className="text-white/70">{line.speaker}</span>
                          <span className="text-white/40">:</span>{' '}
                          <span className="text-white/90">{line.text}</span>
                        </div>
                      ))}

                      {sentenceData && !activeChoice && (
                        <div className="whitespace-pre-wrap break-words">
                          <Sentence
                            key={`${step[0]}-${step[1]}`}
                            assets={assets}
                            data={sentenceData}
                            direct={direct}
                            isComplete={complete}
                            onComplete={handleComplete}
                            prefix={consolePrefix}
                            onProgress={handleConsoleProgress}
                          />
                        </div>
                      )}

                      {activeChoice && (
                        <div className="space-y-2">
                          {activeChoice.prompt && (
                            <div className="whitespace-pre-wrap break-words">
                              <span className="text-emerald-300">&gt;</span>{' '}
                              <span className="text-white/70">{consoleSpeaker}</span>
                              <span className="text-white/40">:</span>{' '}
                              <span className="text-white/90">
                                <Sentence
                                  data={activeChoice.prompt}
                                  isComplete={choiceStage > 0}
                                  onComplete={() => setChoiceStage((prev) => Math.max(prev, 1))}
                                  onProgress={handleConsoleProgress}
                                />
                              </span>
                            </div>
                          )}
                          <div className="space-y-1">
                            {activeChoice.choices.map((choice, index) => {
                              const promptOffset = activeChoice.prompt ? 1 : 0;
                              const canRender = choiceStage >= promptOffset + index;
                              if (!canRender) return null;

                              const isSelected = selectedChoiceIndex === index;

                              return (
                                <button
                                  key={`${choice.text}-${index}`}
                                  type="button"
                                  className={`w-full rounded border px-2 py-1 text-left text-[12px] transition-colors ${isSelected
                                    ? 'border-emerald-500/50 bg-emerald-500/20 text-white'
                                    : 'border-white/15 bg-white/5 text-white/90 hover:bg-white/10'
                                    }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConsoleChoiceSelect(choice);
                                  }}
                                >
                                  <span className={isSelected ? 'text-emerald-300 font-bold' : 'text-emerald-200'}>
                                    [{index + 1}]
                                  </span>{' '}
                                  <Sentence
                                    key={choice.text}
                                    data={choice.text}
                                    isComplete={Boolean(passChoiceTimeoutRef.current) || choiceStage > promptOffset + index}
                                    onComplete={() => setChoiceStage((prev) => Math.max(prev, promptOffset + index + 1))}
                                    onProgress={handleConsoleProgress}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(sentenceData || activeChoice) && (
                  <div
                    className={`flex items-center gap-2 px-3 pb-1 transition-opacity duration-500 ${complete || activeChoice ? 'opacity-100' : 'opacity-50'} ${shake ? 'shake' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-white text-[12px]">&gt;</span>
                      <span className="text-[11px] text-white/70 sm:text-[12px]">
                        {activeChoice ? '숫자를 입력 후 엔터를 입력해주세요' : '엔터나 클릭해주세요'}
                        {(complete || activeChoice) && <span className="terminal-cursor static">▍</span>}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Preload>
  );
};

export default Game;
