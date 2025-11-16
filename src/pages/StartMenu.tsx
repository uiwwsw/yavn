// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/StorageContext';
import LoadBtn from '@/LoadBtn';
import Assets from '@/Preload';
import PartySetup from '@/PartySetup';
import { useEffect, useState } from 'react';
import { getJson } from '#/getJson';
import { Asset, BattleStats } from '#/novelTypes';
import { getDefaultPartyStats } from '#/battleData';
const StartMenuPage = () => {
  const { addStorage, partyStats } = useStorageContext();
  const [asset, setAsset] = useState<Asset>({});
  const assets = Object.values(asset);
  const [setupStats, setSetupStats] = useState<Record<string, BattleStats>>(() => partyStats ?? getDefaultPartyStats());
  const handleStart = () => {
    addStorage({ page: 'game', level: 0, partyStats: setupStats });
  };
  const handleLoad = (level: number) => {
    addStorage({ page: 'game', level, partyStats: setupStats });
  };
  const handleSetupChange = (name: string, stats: BattleStats) => {
    setSetupStats((prev) => ({
      ...prev,
      [name]: stats,
    }));
  };
  const handleReset = () => setSetupStats(getDefaultPartyStats());
  useEffect(() => {
    getJson<Asset>(`start`).then((x) => setAsset(x));
  }, []);
  useEffect(() => {
    if (partyStats) {
      setSetupStats(partyStats);
    }
  }, [partyStats]);

  return (
    <Assets assets={assets}>
      <audio src={asset.audio} autoPlay />
      <div className="relative h-full text-white">
        <img className="h-full w-full object-contain" src={asset.image} alt="시작화면" />
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end gap-4 p-6">
          <div className="pointer-events-auto ml-auto w-full max-w-4xl overflow-y-auto rounded-3xl bg-black/60 p-1 shadow-lg backdrop-blur">
            <PartySetup value={setupStats} onChange={handleSetupChange} onReset={handleReset} />
          </div>
          <div className="pointer-events-auto w-full max-w-xl rounded-3xl bg-black/70 p-5 backdrop-blur">
            <p className="text-sm text-slate-300">설정을 완료하면 바로 모험을 시작할 수 있습니다.</p>
            <div className="mt-3 flex flex-col gap-3">
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
