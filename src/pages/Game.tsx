import { useCallback, useEffect } from 'react';
import Sentence from '@/Sentence';
import Preload from '@/Preload';
import { useStorageContext } from '@/StorageContext';
import useNovelEngine from '#/useNovelEngine';
import Battle from '@/Battle';

const Game = () => {
  const { level, addStorage, partyStats } = useStorageContext();
  const handleGoSavePage = useCallback(() => addStorage({ page: 'save', level }), [addStorage, level]);
  const handleGoCreditPage = useCallback(() => addStorage({ page: 'credit', level: 0 }), [addStorage]);

  const {
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
    battle: battleConfig,
    forceNextScene,
  } = useNovelEngine({
    level,
    onChapterEnd: handleGoSavePage,
    onLoadError: handleGoCreditPage,
  });

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

  const handleBackgroundClick = useCallback(() => {
    if (battleConfig) return;
    nextScene();
  }, [battleConfig, nextScene]);

  useEffect(() => {
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [handleEnter]);

  return (
    <Preload assets={assetList}>
      {battleConfig ? (
        <Battle config={battleConfig} onComplete={handleBattleComplete} partyStats={partyStats} />
      ) : (
        <div onClick={handleBackgroundClick} className="absolute inset-0">
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
      )}
    </Preload>
  );
};

export default Game;
