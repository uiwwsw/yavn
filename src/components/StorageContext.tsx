import useSession from '#/useSession';
import { ReactNode, createContext, useContext } from 'react';
export interface SessionStorage {
  page: 'start' | 'game';
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
