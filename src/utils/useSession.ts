import { SessionStorage } from '@/StorageContext';
import { useEffect, useMemo, useState } from 'react';
const ID = 'session';
const init: string = sessionStorage.getItem(ID) ?? '{}';
const useSession = () => {
  const [_storage, setStorage] = useState<string>(init);
  const storage = useMemo(() => JSON.parse(_storage), [_storage]);
  const addStorage = (param: Partial<SessionStorage>) => {
    setStorage(JSON.stringify({ ...storage, ...param }));
  };
  const clearStorage = () => setStorage('{}');

  useEffect(() => {
    if (_storage === '{}') return;
    sessionStorage.setItem(ID, _storage);
  }, [_storage]);
  return { storage, addStorage, clearStorage };
};

export default useSession;
