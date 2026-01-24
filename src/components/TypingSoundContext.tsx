import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getTypingSoundGenerator } from '../utils/typingSoundGenerator';

interface TypingSoundContextType {
  enabled: boolean;
  volume: number;
  toggleEnabled: () => void;
  setVolume: (volume: number) => void;
}

const TypingSoundContext = createContext<TypingSoundContextType | undefined>(undefined);

interface TypingSoundProviderProps {
  children: ReactNode;
}

export function TypingSoundProvider({ children }: TypingSoundProviderProps) {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [volume, setVolumeState] = useState<number>(0.15);

  useEffect(() => {
    const typingSoundGenerator = getTypingSoundGenerator();
    typingSoundGenerator.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    const typingSoundGenerator = getTypingSoundGenerator();
    typingSoundGenerator.setVolume(volume);
  }, [volume]);

  const toggleEnabled = () => {
    setEnabled((prev) => !prev);
  };

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
  };

  return (
    <TypingSoundContext.Provider value={{ enabled, volume, toggleEnabled, setVolume }}>
      {children}
    </TypingSoundContext.Provider>
  );
}

export function useTypingSound(): TypingSoundContextType {
  const context = useContext(TypingSoundContext);
  if (context === undefined) {
    throw new Error('useTypingSound must be used within a TypingSoundProvider');
  }
  return context;
}