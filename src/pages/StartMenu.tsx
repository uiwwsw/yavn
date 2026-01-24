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
      <div className="relative h-full w-full overflow-hidden bg-black text-white">
        {asset.image && (
          <img
            className="absolute inset-0 h-full w-full object-contain"
            src={asset.image}
            alt="시작화면"
            loading="eager"
            decoding="async"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-black/35 to-black/70" />

        <div className="relative flex h-full w-full flex-col items-center justify-start p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/55 p-5 backdrop-blur-md">
            <div className="flex flex-col gap-3">
              <Btn autoFocus onClick={handleStart}>
                시작하기
              </Btn>
              <LoadBtn onChange={handleLoad}>불러오기</LoadBtn>
            </div>
          </div>
        </div>
      </div>
    </Preload>
  );
};

export default StartMenuPage;
