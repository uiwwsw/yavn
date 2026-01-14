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
  if (Array.isArray(data)) return data.map((entry) => entry.message).join('');
  return (data as SentenceEntry).message;
};

const Game = () => {
  const { level, addStorage } = useStorageContext();
  const [passMode, setPassMode] = useState(false);

  const passAdvanceTimeoutRef = useRef<number | null>(null);
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

  const consoleViewportRef = useRef<HTMLDivElement | null>(null);
  const isConsoleTypingRef = useRef(false);
  const userScrolledRef = useRef(false);

  const currentSentenceRef = useRef<unknown>(null);
  const lastSentenceLineRef = useRef<{ speaker: string; text: string } | null>(null);
  const nextConsoleIdRef = useRef(0);

  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [consoleTick, setConsoleTick] = useState(0);

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
  }, [level]);

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

    if (currentSentenceRef.current !== sentence) {
      // 새 문장이 시작되면(타이핑 시작) 자동으로 하단 고정.
      userScrolledRef.current = false;

      if (currentSentenceRef.current !== null && lastSentenceLineRef.current) {
        appendConsoleLine(lastSentenceLineRef.current.speaker, lastSentenceLineRef.current.text);
      }

      currentSentenceRef.current = sentence;
      lastSentenceLineRef.current = sentenceData ? { speaker: consoleSpeaker, text: flattenSentenceData(sentenceData) } : null;
    }
  }, [appendConsoleLine, battleConfig, consoleSpeaker, sentence, sentenceData]);

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

      appendConsoleLine('사용자', choice.text);
      handleChoiceSelect(choice);
    },
    [appendConsoleLine, handleChoiceSelect],
  );

  const handleEnter = useCallback(
    (e: KeyboardEvent) => {
      if (battleConfig) return;
      if (e.code === 'Enter') nextScene();
    },
    [battleConfig, nextScene],
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

  useEffect(() => {
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [handleEnter]);

  useEffect(() => {
    if (passAdvanceTimeoutRef.current) {
      window.clearTimeout(passAdvanceTimeoutRef.current);
      passAdvanceTimeoutRef.current = null;
    }

    if (!passMode) return;
    if (battleConfig) return;
    if (activeChoice) return;
    if (!complete) return;

    passAdvanceTimeoutRef.current = window.setTimeout(() => {
      nextScene();
    }, 240);

    return () => {
      if (passAdvanceTimeoutRef.current) {
        window.clearTimeout(passAdvanceTimeoutRef.current);
        passAdvanceTimeoutRef.current = null;
      }
    };
  }, [activeChoice, battleConfig, complete, nextScene, passMode]);

  useEffect(() => {
    if (passChoiceTimeoutRef.current) {
      window.clearTimeout(passChoiceTimeoutRef.current);
      passChoiceTimeoutRef.current = null;
    }

    if (!passMode) return;
    if (battleConfig) return;
    if (!activeChoice) return;
    if (!activeChoice.choices.length) return;

    passChoiceTimeoutRef.current = window.setTimeout(() => {
      const index = Math.floor(Math.random() * activeChoice.choices.length);
      const picked = activeChoice.choices[index];
      if (!picked) return;

      appendConsoleLine('PASS', picked.text);
      handleChoiceSelect(picked);
    }, 520);

    return () => {
      if (passChoiceTimeoutRef.current) {
        window.clearTimeout(passChoiceTimeoutRef.current);
        passChoiceTimeoutRef.current = null;
      }
    };
  }, [activeChoice, appendConsoleLine, battleConfig, handleChoiceSelect, passMode]);

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
    return activeChoice ? 'h-[clamp(160px,36vh,220px)]' : 'h-[106px]';
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
          {place && assets[place]?.image && (
            <img className="absolute h-full w-full object-cover" src={assets[place]?.image} alt={place} />
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
                              <span className="text-white/90">{activeChoice.prompt}</span>
                            </div>
                          )}
                          <div className="space-y-1">
                            {activeChoice.choices.map((choice, index) => (
                              <button
                                key={`${choice.text}-${index}`}
                                type="button"
                                className="w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-left text-[12px] text-white/90 hover:bg-white/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConsoleChoiceSelect(choice);
                                }}
                              >
                                <span className="text-emerald-200">[{index + 1}]</span> {choice.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Preload>
  );
};

export default Game;
