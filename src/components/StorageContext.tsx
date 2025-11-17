import useSession from '#/useSession';
import { ReactNode, createContext, useContext } from 'react';
export interface SessionStorage {
  level: number;
  page: 'startMenu' | 'game' | 'save' | 'credit' | 'gameOver';
  inventory: boolean;
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
