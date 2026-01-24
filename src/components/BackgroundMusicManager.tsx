import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MusicState, MusicPriority } from '../utils/novelTypes';

interface BackgroundMusicManagerProps {
  musicState: MusicState;
  onStateChange: (state: Partial<MusicState>) => void;
}

export const BackgroundMusicManager: React.FC<BackgroundMusicManagerProps> = ({
  musicState,
  onStateChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Priority order: situational > location > chapter
  const getPriorityValue = (priority: MusicPriority): number => {
    switch (priority) {
      case 'situational': return 3;
      case 'location': return 2;
      case 'chapter': return 1;
      default: return 0;
    }
  };

  const fadeIn = useCallback((duration: number = 1000) => {
    if (!audioRef.current) return;

    audioRef.current.volume = 0;
    const targetVolume = musicState.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = targetVolume / steps;

    let currentStep = 0;
    const fadeInterval = setInterval(() => {
      currentStep++;
      if (audioRef.current) {
        audioRef.current.volume = Math.min(volumeStep * currentStep, targetVolume);
      }

      if (currentStep >= steps) {
        clearInterval(fadeInterval);
      }
    }, stepDuration);
  }, [musicState.volume]);

  // Debug helper
  useEffect(() => {
    console.log('BackgroundMusicManager: musicState changed:', musicState);
  }, [musicState]);

  // User interaction helper
  const enableAudio = useCallback(async () => {
    // Check if there's pending music to play
    const pendingMusic = (window as any).pendingMusic;
    if (pendingMusic && audioRef.current) {
      const { musicUrl, priority } = pendingMusic;
      audioRef.current.src = musicUrl;
      audioRef.current.loop = true;
      try {
        await audioRef.current.play();
        fadeIn(500);
        onStateChange({ current: musicUrl, priority, isPlaying: true });
        console.log(`🎵 Pending music now playing: ${musicUrl} (${priority})`);
        delete (window as any).pendingMusic;
      } catch (error) {
        console.log('Still failed to play audio after user interaction');
      }
    } else if (audioRef.current) {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.log('Audio play failed, will retry on user interaction');
      }
    }
  }, [fadeIn, onStateChange]);

  const fadeOut = useCallback((duration: number = 1000, callback?: () => void) => {
    if (!audioRef.current) {
      callback?.();
      return;
    }

    const initialVolume = audioRef.current.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = initialVolume / steps;

    let currentStep = 0;
    const fadeInterval = setInterval(() => {
      currentStep++;
      if (audioRef.current) {
        audioRef.current.volume = Math.max(initialVolume - (volumeStep * currentStep), 0);
      }

      if (currentStep >= steps || !audioRef.current || audioRef.current.volume <= 0) {
        clearInterval(fadeInterval);
        callback?.();
      }
    }, stepDuration);
  }, []);

  const playMusic = useCallback(async (musicUrl: string, priority: MusicPriority) => {
    console.log(`🎵 [BackgroundMusicManager] playMusic CALLED: ${musicUrl} (${priority})`);

    if (!audioRef.current) {
      console.error("🎵 [BackgroundMusicManager] audioRef.current is NULL!");
      return;
    }

    // Check format support
    const isOgg = musicUrl.endsWith('.ogg');
    if (isOgg) {
      const canPlay = audioRef.current.canPlayType('audio/ogg');
      console.log(`🎵 [BackgroundMusicManager] Format check: OGG -> ${canPlay || 'no'}`);
    }

    const currentPriorityValue = getPriorityValue(musicState.priority);
    const newPriorityValue = getPriorityValue(priority);

    // If no current music or new music has higher priority, play it
    if (!musicState.current || newPriorityValue > currentPriorityValue) {
      const playAudio = async () => {
        if (audioRef.current) {
          audioRef.current.src = musicUrl;
          audioRef.current.loop = true;
          try {
            console.log(`🎵 [BackgroundMusicManager] Calling play() for: ${musicUrl}`);
            await audioRef.current.play();
            fadeIn(!musicState.current ? 1000 : 500);
            onStateChange({ current: musicUrl, priority, isPlaying: true });
            console.log(`🎵 [BackgroundMusicManager] PLAY SUCCESS: ${musicUrl}`);
          } catch (error: any) {
            console.error(`🎵 [BackgroundMusicManager] PLAY ERROR:`, error);

            // Store the music info to play after user interaction
            (window as any).pendingMusic = { musicUrl, priority };
            // Wait for user interaction then retry
            document.addEventListener('click', enableAudio, { once: true });
            document.addEventListener('keydown', enableAudio, { once: true });
          }
        }
      };

      if (musicState.current && newPriorityValue > currentPriorityValue) {
        fadeOut(500, playAudio);
      } else {
        playAudio();
      }
    }
    // If same or lower priority, don't change
    else {
      console.log(`🎵 [BackgroundMusicManager] Blocked: ${musicUrl} (${priority}) - lower priority than current: ${musicState.current} (${musicState.priority})`);
    }
  }, [musicState.priority, musicState.current, fadeOut, fadeIn, onStateChange, enableAudio]);

  const stopMusic = useCallback((priority: MusicPriority) => {
    const currentPriorityValue = getPriorityValue(musicState.priority);
    const stopPriorityValue = getPriorityValue(priority);

    // Only stop if the priority matches or is higher
    if (stopPriorityValue >= currentPriorityValue) {
      fadeOut(1000, () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          onStateChange({ current: null, priority: 'chapter', isPlaying: false });
        }
      });
    }
  }, [musicState.priority, fadeOut, onStateChange]);

  const returnToPreviousPriority = useCallback(async () => {
    // This will be called when situational music ends
    // Logic to return to location or chapter music will be handled by the engine
    fadeOut(500, async () => {
      onStateChange({ current: null, priority: 'chapter', isPlaying: false });
      // Engine will trigger appropriate music change
    });
  }, [fadeOut, onStateChange]);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      console.log('🎵 [BackgroundMusicManager] Initializing Audio element...');
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
      audioRef.current.loop = true;
      setIsInitialized(true);
    }

    return () => {
      console.log('🎵 [BackgroundMusicManager] Disposing Audio element...');
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current && isInitialized) {
      audioRef.current.volume = musicState.volume;
    }
  }, [musicState.volume, isInitialized]);

  // Expose controls to parent
  useEffect(() => {
    // These methods will be called by the useNovelEngine
    (window as any).backgroundMusicManager = {
      playMusic,
      stopMusic,
      returnToPreviousPriority,
    };
  }, [playMusic, stopMusic, returnToPreviousPriority]);

  return null; // This component doesn't render anything
};