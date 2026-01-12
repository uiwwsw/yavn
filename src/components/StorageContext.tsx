import useSession from '#/useSession';
import { ReactNode } from 'react';

import { StorageContext } from './StorageContextContext';

export interface SessionStorage {
  level: number;
  page: 'startMenu' | 'game' | 'save' | 'credit' | 'gameOver';
  inventory: boolean;
}
interface StorageProviderProps {
  children?: ReactNode;
}
export const StorageProvider = ({ children }: StorageProviderProps) => {
  const { addStorage, clearStorage, storage } = useSession();
  return (
    <StorageContext.Provider
      value={{
        ...storage,
        addStorage,
        clearStorage,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};
