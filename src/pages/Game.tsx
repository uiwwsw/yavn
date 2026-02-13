import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Battle from '@/Battle';
import { BackgroundMusicManager } from '@/BackgroundMusicManager';
import Preload from '@/Preload';
import SceneControls from '@/SceneControls';
import Sentence from '@/Sentence';
import Backlog from '@/Backlog';
import GameSettings from '@/GameSettings';
import SaveSlots from '@/SaveSlots';
import { useStorageContext } from '@/useStorageContext';
import { useSettings } from '../contexts/SettingsContext';

import useNovelEngine from '#/useNovelEngine';
import type { ChoiceOption, SentenceData, SentenceEntry, BacklogEntry } from '#/novelTypes';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { performQuickSave, performQuickLoad } from '../utils/QuickSave';

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
  const { settings } = useSettings();
  const [passMode, setPassMode] = useState(false);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [showSaveSlots, setShowSaveSlots] = useState(false);
  const [saveSlotsMode, setSaveSlotsMode] = useState<'save' | 'load'>('save');
  const [showUI, setShowUI] = useState(true);

  // Quick Load State
  const [pendingLoadStep, setPendingLoadStep] = useState<number | null>(null);

  const passChoiceTimeoutRef = useRef<number | null>(null);
  const handleGoSavePage = useCallback(() => addStorage({ page: 'save', level }), [addStorage, level]);
  const handleGoToBeContinued = useCallback(() => addStorage({ page: 'toBeContinued', level: 0 }), [addStorage]);

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
    musicState,
    updateMusicState,
    goToStep,
  } = useNovelEngine({
    level,
    initialSentenceIndex: pendingLoadStep ?? 0,
    autoAdvanceDelay: settings.autoSpeed, // Use setting value
    onChapterEnd: handleGoSavePage,
    onLoadError: handleGoToBeContinued,
  });

  // Clear pending load step after successful initialization
  useEffect(() => {
    if (assets && Object.keys(assets).length > 0 && pendingLoadStep !== null) {
      setPendingLoadStep(null);
    }
  }, [assets, pendingLoadStep]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (assets && Object.keys(assets).length > 0) {
      setIsInitialized(true);
      // 자동 저장 (챕터 시작 시 또는 로드 직후)
      // 실제로는 중요한 포인트에서만 하는게 좋지만 일단은 간단하게
      if (step[1] === 0) {
        // autoSave functionality can be added here
      }
    } else {
      setIsInitialized(false);
    }
  }, [assets, step]);

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
        setTimeout(() => setIsFading(false), 50);
      }, 500);

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
  }, [level]);

  const consoleSpeaker = character ?? '';

  useEffect(() => {
    const typing = !battleConfig && Boolean(sentenceData) && !activeChoice && !complete;
    isConsoleTypingRef.current = typing;
    if (typing || activeChoice) {
      userScrolledRef.current = false;
    }
  }, [activeChoice, battleConfig, complete, sentenceData]);

  useEffect(() => {
    if (battleConfig) return;
    if (!sentence) return;
    if (!isInitialized) return;

    if (currentSentenceRef.current !== sentence) {
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

  /* Helper Actions */
  const handleQuickSave = useCallback(() => {
    if (!sentenceData) return;
    performQuickSave({
      level: level ?? 0,
      chapterIndex: step[0],
      sentenceIndex: step[1],
      playTime: 0, // TODO: Implement play time tracking
      chapterTitle: `Chapter ${level}`, // TODO: Get actual title
      characterName: consoleSpeaker,
      placeName: place,
      // Screenshot can be added here if we use html2canvas or similar
    });
    alert('퀵 세이브 되었습니다.'); // TODO: Toast notification
  }, [level, step, consoleSpeaker, place, sentenceData]);

  const handleQuickLoad = useCallback(() => {
    const data = performQuickLoad();
    if (!data) {
      alert('퀵 세이브 데이터가 없습니다.');
      return;
    }

    if (data.level !== level) {
      setPendingLoadStep(data.sentenceIndex);
      addStorage({ page: 'game', level: data.level });
    } else {
      goToStep([data.chapterIndex, data.sentenceIndex]);
    }
  }, [level, addStorage, goToStep]);

  const handleManualSave = useCallback(() => {
    setSaveSlotsMode('save');
    setShowSaveSlots(true);
  }, []);

  const handleManualLoad = useCallback(() => {
    setSaveSlotsMode('load');
    setShowSaveSlots(true);
  }, []);

  const handleSlotLoad = useCallback((data: any) => { // Type should be SaveData but using any to avoid import issues
    if (data.level !== level) {
      setPendingLoadStep(data.sentenceIndex);
      addStorage({ page: 'game', level: data.level });
    } else {
      goToStep([data.chapterIndex, data.sentenceIndex]);
    }
    setShowSaveSlots(false);
  }, [level, addStorage, goToStep]);

  /* Keyboard Navigation */
  useKeyboardNavigation({
    onNext: () => {
      if (!showBacklog && !showSettings && !activeChoice) {
        nextScene();
      }
    },
    onSkip: () => setPassMode((prev) => !prev),
    onAuto: () => setAuto((prev) => !prev),
    onMenu: () => {
      if (showBacklog) setShowBacklog(false);
      else if (showSettings) setShowSettings(false);
      else setShowSettings(true);
    },
    onBacklog: () => setShowBacklog((prev) => !prev),
    onQuickSave: handleQuickSave,
    onQuickLoad: handleQuickLoad,
    onHideUI: () => setShowUI((prev) => !prev),
    onChoice: (index) => {
      if (activeChoice && index >= 0 && index < activeChoice.choices.length) {
        handleConsoleChoiceSelect(activeChoice.choices[index]);
      }
    }
  });

  /* Touch Gestures */
  const wrapperRef = useRef<HTMLDivElement>(null);
  useTouchGestures(wrapperRef, {
    onTap: () => {
      if (!showBacklog && !showSettings && !activeChoice && !battleConfig) {
        nextScene();
      }
    },
    onSwipeUp: () => setShowUI(false),
    onSwipeDown: () => setShowBacklog(true),
    onSwipeLeft: () => { }, // Future use
    onSwipeRight: () => setShowUI(true),
    onLongPress: () => setShowSettings(true),
  });

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

  useEffect(() => {
    if (activeChoice && !activeChoice.prompt && choiceStage === 0) {
      setChoiceStage(1);
    }
  }, [activeChoice, choiceStage]);

  // Handle Pass Mode Auto Choice
  useEffect(() => {
    const promptOffset = activeChoice?.prompt ? 1 : 0;
    const totalStages = (activeChoice?.choices?.length ?? 0) + promptOffset;
    const isReady = activeChoice && choiceStage >= totalStages;

    if (!passMode || !isReady || !activeChoice) return;

    if (passChoiceTimeoutRef.current) {
      window.clearTimeout(passChoiceTimeoutRef.current);
    }

    passChoiceTimeoutRef.current = window.setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * activeChoice.choices.length);
      const choice = activeChoice.choices[randomIndex];
      handleConsoleChoiceSelect(choice);
    }, 100 / settings.textSpeed); // Faster in pass mode, dependent on text speed

    return () => {
      if (passChoiceTimeoutRef.current) {
        window.clearTimeout(passChoiceTimeoutRef.current);
        passChoiceTimeoutRef.current = null;
      }
    };
  }, [passMode, activeChoice, choiceStage, handleConsoleChoiceSelect, settings.textSpeed]);

  const consolePrefix = useMemo(
    () => {
      if (!consoleSpeaker) {
        return (
          <span className="text-emerald-300">&gt;</span>
        );
      }
      return (
        <>
          <span className="text-emerald-300">&gt;</span>{' '}
          <span className="text-white/70">{consoleSpeaker}</span>
          <span className="text-white/40">:</span>{' '}
        </>
      );
    },
    [consoleSpeaker],
  );

  const consoleDockClass = useMemo(() => {
    return direct ? 'justify-start' : 'justify-end';
  }, [direct]);

  const consoleHeightClass = useMemo(() => {
    return activeChoice ? 'h-[clamp(160px,36vh,220px)]' : 'h-[118px]';
  }, [activeChoice]);

  // Backlog Data transformation
  const backlogEntries: BacklogEntry[] = useMemo(() => {
    return consoleLines.map(line => ({
      id: line.id.toString(),
      character: line.speaker,
      text: line.text,
      timestamp: Date.now() // Approximated
    }));
  }, [consoleLines]);

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <BackgroundMusicManager
        musicState={musicState}
        onStateChange={updateMusicState} // This needs to be checked if onStateChange exists in BackgroundMusicManager
      />
      <GameSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <Backlog entries={backlogEntries} isOpen={showBacklog} onClose={() => setShowBacklog(false)} />
      {showSaveSlots && (
        <SaveSlots
          mode={saveSlotsMode}
          onClose={() => setShowSaveSlots(false)}
          onLoad={handleSlotLoad}
          currentData={sentenceData ? {
            level: level ?? 0,
            chapterIndex: step[0],
            sentenceIndex: step[1],
            playTime: 0,
            chapterTitle: `Chapter ${level}`,
            characterName: consoleSpeaker,
            placeName: place,
          } : undefined}
        />
      )}

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
          <div className="absolute inset-0">
            {/* Click area for touching background */}
            <div className="absolute inset-0 z-0" onClick={handleBackgroundClick} />

            <div className={`pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-start p-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:p-4 transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
              <div onClick={(e) => e.stopPropagation()}>
                <SceneControls
                  auto={auto}
                  onAutoChange={setAuto}
                  pass={passMode}
                  onPassChange={setPassMode}
                  onBacklogOpen={() => setShowBacklog(true)}
                  onSettingsOpen={() => setShowSettings(true)}
                  onSaveOpen={handleManualSave}
                  onLoadOpen={handleManualLoad}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {displayCharacter && characterImage && (
                <motion.img
                  key={characterImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="pointer-events-none absolute bottom-0 z-10 max-h-96 object-contain"
                  style={characterPosition}
                  src={characterImage}
                  alt={displayCharacter}
                />
              )}
            </AnimatePresence>
            {displayPlace && assets[displayPlace]?.image && (
              <img
                className={`pointer-events-none absolute h-full w-full object-cover transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}
                src={assets[displayPlace]?.image}
                alt={displayPlace}
              />
            )}

            {sentence && (
              <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex ${consoleDockClass} px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:px-3 sm:pb-2 transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
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
                            {line.speaker ? (
                              <>
                                <span className="text-white/70">{line.speaker}</span>
                                <span className="text-white/40">:</span>{' '}
                              </>
                            ) : null}
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
    </div>
  );
};

export default Game;
