import { useEffect, useMemo, useState, useRef, useCallback } from 'react';

import Btn from '@/Btn';
import LoadBtn from '@/LoadBtn';
import Preload from '@/Preload';
import { useStorageContext } from '@/useStorageContext';

import { getJson } from '#/getJson';
import type { Asset, Assets } from '#/novelTypes';

const preloadLoose = (url: string) => {
  if (!url) return;

  if (url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.ogg') || url.endsWith('.m4a')) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    return;
  }

  const img = new Image();
  img.decoding = 'async';
  img.src = url;
};

const StartMenuPage = () => {
  const { addStorage } = useStorageContext();
  const [asset, setAsset] = useState<Asset>({});
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const preloadAssets = useMemo(() => {
    const list = [asset.image, asset.audio].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [asset.audio, asset.image]);

  const attemptAudioPlay = useCallback(async () => {
    if (!asset.audio || audioPlayed) return;

    try {
      if (audioRef.current) {
        audioRef.current.volume = 0.3;
        await audioRef.current.play();
        setAudioPlayed(true);
      }
    } catch (error) {
      console.log('Audio autoplay prevented, will try user interaction');
    }
  }, [asset.audio, audioPlayed]);

  const handleInteract = () => {
    setShowMenu(true);
    attemptAudioPlay();
  };

  const handleStart = () => {
    attemptAudioPlay();
    addStorage({ page: 'game', level: 0 });
  };

  const handleLoad = (level: number) => {
    attemptAudioPlay();
    addStorage({ page: 'game', level });
  };

  useEffect(() => {
    let cancelled = false;
    getJson<Asset>('start')
      .then((x) => {
        if (!cancelled) setAsset(x);
      })
      .catch(() => {
        if (!cancelled) setAsset({ image: '/start.png', audio: '/start.mp3' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // StartMenu가 떠있는 동안, 첫 챕터 에셋을 "느슨하게"(UI 블로킹 없이) 미리 예열해서
  // 게임 시작 직후 이미지가 늦게 뜨는 현상을 줄인다.
  useEffect(() => {
    let cancelled = false;
    if (!asset.image) return;

    const warmChapterZero = async () => {
      try {
        // Use fetch without cache-busting to allow browser caching for preloading
        const res = await fetch('/assets0.json');
        const data = await res.json() as Assets;
        if (cancelled) return;

        const urls = Array.from(
          new Set(Object.values(data).flatMap((entry) => Object.values(entry).filter(Boolean) as string[])),
        );

        for (const url of urls) preloadLoose(url);
      } catch {
        // ignore
      }
    };

    const timeout = window.setTimeout(() => {
      warmChapterZero();
    }, 500); // Slight delay to avoid competing with game initialization

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [asset.image]);

  // Enhanced audio management
  useEffect(() => {
    if (!asset.audio) return;

    const audio = new Audio(asset.audio);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.3;
    audioRef.current = audio;

    // Try to play immediately
    const tryPlay = async () => {
      try {
        await audio.play();
        setAudioPlayed(true);
      } catch (error) {
        console.log('Audio autoplay blocked - requires user interaction');
        // Set up event listeners for user interaction
        const handleFirstInteraction = () => {
          audio.play().then(() => {
            setAudioPlayed(true);
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('keydown', handleFirstInteraction);
          }).catch(console.error);
        };

        document.addEventListener('click', handleFirstInteraction, { once: true });
        document.addEventListener('keydown', handleFirstInteraction, { once: true });
      }
    };

    tryPlay();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [asset.audio]);

  return (
    <Preload assets={preloadAssets}>
      <div
        className="relative h-full w-full cursor-pointer overflow-hidden bg-black text-white"
        onClick={handleInteract}
      >
        {asset.image && (
          <img
            className="absolute inset-0 h-full w-full object-contain"
            src={asset.image}
            alt="시작화면"
            loading="eager"
            decoding="async"
          />
        )}

        <div className={`absolute inset-0 bg-black/60 transition-opacity duration-1000 ${showMenu ? 'opacity-100' : 'opacity-0'}`} />

        <div className={`relative flex h-full w-full flex-col items-center justify-center p-6 transition-all duration-700 ${showMenu ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}>
          <div className="flex w-full max-w-sm flex-col gap-6">
            <Btn
              onClick={handleStart}
              className="group relative overflow-hidden border-2 border-white/20 bg-black/40 px-8 py-4 text-xl font-bold tracking-widest text-white backdrop-blur-sm transition-all hover:border-white/60 hover:bg-black/60 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">시작하기</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </Btn>

            <LoadBtn
              onChange={handleLoad}
              className="group relative overflow-hidden border-2 border-white/20 bg-black/40 px-8 py-4 text-xl font-bold tracking-widest text-white backdrop-blur-sm transition-all hover:border-white/60 hover:bg-black/60 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">불러오기</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </LoadBtn>
          </div>
        </div>

        {!showMenu && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/50 animate-pulse text-lg tracking-widest font-light">
            아무 곳이나 클릭하세요
          </div>
        )}
      </div>
    </Preload>
  );
};

export default StartMenuPage;
