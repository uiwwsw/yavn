import { createContext } from 'react';

import type { SessionStorage } from './StorageContext';

interface ContextProps extends Partial<SessionStorage> {
  addStorage: (param: Partial<SessionStorage>) => void;
  clearStorage: () => void;
}

export const StorageContext = createContext<ContextProps>({
  page: undefined,
  level: undefined,
  inventory: false,
  addStorage: () => null,
  clearStorage: () => null,
});
