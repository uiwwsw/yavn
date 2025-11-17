// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/StorageContext';
import LoadBtn from '@/LoadBtn';
import Assets from '@/Preload';
import { useEffect, useState } from 'react';
import { getJson } from '#/getJson';
import { Asset } from '#/novelTypes';
const StartMenuPage = () => {
  const { addStorage } = useStorageContext();
  const [asset, setAsset] = useState<Asset>({});
  const assets = Object.values(asset);
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
      <audio src={asset.audio} autoPlay />
      <div className="relative h-full text-white">
        <img className="h-full w-full object-contain" src={asset.image} alt="시작화면" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-end justify-end gap-4 p-6">
          <div className="pointer-events-auto w-full max-w-xl rounded-3xl border border-white/10 bg-black/70 p-5 text-sm backdrop-blur">
            <div className="flex flex-col gap-3">
              <Btn autoFocus onClick={handleStart}>
                시작하기
              </Btn>
              <LoadBtn onChange={handleLoad}>불러오기</LoadBtn>
            </div>
          </div>
        </div>
      </div>
    </Assets>
  );
};

export default StartMenuPage;
