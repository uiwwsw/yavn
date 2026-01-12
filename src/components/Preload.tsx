import { ReactNode, useLayoutEffect, useState, memo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface PreloadProps {
  assets: string[];
  children: ReactNode;
}
const audioTypes = ['.wav', '.mp3', '.ogg'];

const Preload = ({ assets, children }: PreloadProps) => {
  const [load, setLoad] = useState(false);
  
  const preloadAsset = useCallback(async (asset: string) => {
    if (audioTypes.some((type) => asset.endsWith(type))) {
      const ado = new Audio();
      ado.src = asset;
      return new Promise<void>((res) => {
        ado.onloadedmetadata = () => res();
        ado.onerror = () => res();
      });
    }
    const img = new Image();
    img.src = asset;
    return new Promise<void>((res) => {
      img.onload = () => res();
      img.onerror = () => res();
    });
  }, []);

  useLayoutEffect(() => {
    if (assets.length === 0) {
      setLoad(true);
      return;
    }
    
    Promise.all(assets.map(preloadAsset))
      .then(() => setLoad(true))
      .catch(() => setLoad(true)); // 실패해도 계속 진행
  }, [assets, preloadAsset]);
  return load ? (
    <motion.div className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {children}
    </motion.div>
  ) : (
    <div className="flex h-full w-full items-center justify-center">
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
