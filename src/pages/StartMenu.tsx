// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/StorageContext';
import LoadBtn from '@/LoadBtn';
import Assets from '@/Preload';
import { useEffect, useMemo, useState } from 'react';
import { getJson } from '#/getJson';
import { Asset } from './Game';
const StartMenuPage = () => {
  const { addStorage } = useStorageContext();
  const [asset, setAsset] = useState<Asset>({});
  const assets = useMemo(() => Object.values(asset), [asset]);
  const handleStart = () => {
    addStorage({ page: 'game', level: 0 });
  };
  const handleLoad = (level: number) => {
    addStorage({ page: 'game', level });
  };
  useEffect(() => {
    getJson<Asset>(`start`).then((x) => setAsset(x));
  }, []);
  return (
    <Assets assets={assets}>
      <audio src={asset.audio}></audio>
      <div className="relative h-full text-white">
        <img className="h-full w-full object-cover" src={asset.image} alt="시작화면" />
        <div className="absolute inset-0 top-auto m-auto flex w-3/5 flex-col gap-3 pb-10">
          <Btn autoFocus onClick={handleStart}>
            시작하기
          </Btn>
          <LoadBtn onChange={handleLoad}>불러오기</LoadBtn>
        </div>
      </div>
    </Assets>
  );
};

export default StartMenuPage;
