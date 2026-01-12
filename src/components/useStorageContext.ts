import { useContext } from 'react';

import { StorageContext } from './StorageContextContext';

export const useStorageContext = () => useContext(StorageContext);
