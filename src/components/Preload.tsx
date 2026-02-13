import { ReactNode, memo, useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface PreloadProps {
  assets: string[];
  children: ReactNode;
}

const MAX_CONCURRENT = 5;
const audioTypes = ['.wav', '.mp3', '.ogg', '.m4a'];

const Preload = ({ assets, children }: PreloadProps) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const mountedRef = useRef(true);

  const assetList = useMemo(() => {
    return Array.from(new Set(assets.filter(Boolean)));
  }, [assets]);

  useEffect(() => {
    mountedRef.current = true;
    if (assetList.length === 0) {
      setIsComplete(true);
      return;
    }

    setIsComplete(false);
    setProgress(0);

    let activeDownloads = 0;
    let currentIndex = 0;
    let loadedCount = 0;
    const total = assetList.length;

    const loadAsset = async (asset: string) => {
      try {
        if (audioTypes.some((type) => asset.endsWith(type))) {
          await new Promise<void>((resolve) => {
            const audio = new Audio();
            audio.onloadeddata = () => resolve();
            audio.onerror = () => resolve(); // Don't block on error
            audio.src = asset;
          });
        } else {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = asset;
          });
        }
      } catch (e) {
        // Ignore errors
      }
    };

    const processQueue = () => {
      if (!mountedRef.current) return;

      // Check completion
      if (loadedCount >= total) {
        setIsComplete(true);
        return;
      }

      // Fill queue
      while (activeDownloads < MAX_CONCURRENT && currentIndex < total) {
        const asset = assetList[currentIndex];
        currentIndex++;
        activeDownloads++;

        loadAsset(asset).finally(() => {
          if (!mountedRef.current) return;
          activeDownloads--;
          loadedCount++;
          setProgress((loadedCount / total) * 100);
          processQueue();
        });
      }
    };

    processQueue();

    return () => {
      mountedRef.current = false;
    };
  }, [assetList]);

  return isComplete ? (
    <motion.div className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {children}
    </motion.div>
  ) : (
    <div className="flex flex-col h-full w-full items-center justify-center bg-black gap-4">
      <svg className="h-24 w-24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <circle fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="15" r="15" cx="40" cy="65">
          <animate
            attributeName="cy"
            calcMode="spline"
            dur="2"
            values="65;135;65;"
            keySplines=".5 0 .5 1;.5 0 .5 1"
            repeatCount="indefinite"
            begin="-.4"
          ></animate>
        </circle>
        <circle fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="15" r="15" cx="100" cy="65">
          <animate
            attributeName="cy"
            calcMode="spline"
            dur="2"
            values="65;135;65;"
            keySplines=".5 0 .5 1;.5 0 .5 1"
            repeatCount="indefinite"
            begin="-.2"
          ></animate>
        </circle>
        <circle fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="15" r="15" cx="160" cy="65">
          <animate
            attributeName="cy"
            calcMode="spline"
            dur="2"
            values="65;135;65;"
            keySplines=".5 0 .5 1;.5 0 .5 1"
            repeatCount="indefinite"
            begin="0"
          ></animate>
        </circle>
      </svg>
      {/* Progress Bar */}
      <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      <div className="text-white/50 text-xs font-mono">{Math.round(progress)}%</div>
    </div>
  );
};

export default memo(Preload);
