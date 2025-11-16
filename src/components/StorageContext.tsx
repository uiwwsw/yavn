import useSession from '#/useSession';
import { ReactNode, createContext, useContext } from 'react';
import { BattleStats } from '#/novelTypes';
export interface SessionStorage {
  level: number;
  page: 'startMenu' | 'game' | 'save' | 'credit' | 'gameOver';
  inventory: boolean;
  partyStats?: Record<string, BattleStats>;
}
interface StorageProviderProps {
  children?: ReactNode;
}
interface ContextProps extends Partial<SessionStorage> {
  addStorage: (param: Partial<SessionStorage>) => void;
  clearStorage: () => void;
}
const StorageContext = createContext<ContextProps>({
  page: undefined,
  level: undefined,
  inventory: false,
  partyStats: undefined,
  addStorage: () => null,
  clearStorage: () => null,
});
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
export const useStorageContext = () => useContext(StorageContext);
