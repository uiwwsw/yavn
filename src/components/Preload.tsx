import { ReactNode, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PreloadProps {
  assets: string[];
  children: ReactNode;
}
const audioTypes = ['.wav', '.mp3', '.ogg'];

const Preload = ({ assets, children }: PreloadProps) => {
  const [load, setLoad] = useState(false);
  useLayoutEffect(() => {
    if (assets.length)
      Promise.all(
        assets.map(async (asset) => {
          if (audioTypes.some((type) => asset.endsWith(type))) {
            const ado = new Audio();
            ado.src = asset;
            return new Promise((res) => {
              ado.onloadedmetadata = () => res(true);
            });
          }
          const img = new Image();
          img.src = asset;
          return new Promise((res) => {
            img.onload = () => res(true);
          });
        }),
      ).then(() => setLoad(true));
  }, [assets]);
  return load ? (
    <motion.div className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {children}
    </motion.div>
  ) : (
    <div className="h-full w-full">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
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

export default Preload;
