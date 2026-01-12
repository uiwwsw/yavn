import { ReactNode, memo, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface PreloadProps {
  assets: string[];
  children: ReactNode;
}

const audioTypes = ['.wav', '.mp3', '.ogg', '.m4a'];

const Preload = ({ assets, children }: PreloadProps) => {
  const [loaded, setLoaded] = useState(false);

  const assetList = useMemo(() => {
    const unique = new Set<string>();
    for (const asset of assets) {
      if (!asset) continue;
      unique.add(asset);
    }
    return Array.from(unique);
  }, [assets]);

  const preloadAsset = useCallback(async (asset: string) => {
    if (audioTypes.some((type) => asset.endsWith(type))) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = asset;
      return new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => resolve();
      });
    }

    const img = new Image();
    img.decoding = 'async';
    img.src = asset;
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;

    setLoaded(false);

    if (assetList.length === 0) {
      setLoaded(true);
      return;
    }

    Promise.all(assetList.map(preloadAsset))
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [assetList, preloadAsset]);

  return loaded ? (
    <motion.div className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {children}
    </motion.div>
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-black">
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
    </div>
  );
};

export default memo(Preload);
