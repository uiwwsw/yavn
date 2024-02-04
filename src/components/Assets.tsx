import { ReactNode, useLayoutEffect, useState } from 'react';

interface AssetsProps {
  assets: string[];
  children: ReactNode;
}
const audioType = '.wav';
const Assets = ({ assets, children }: AssetsProps) => {
  const [load, setLoad] = useState(false);
  useLayoutEffect(() => {
    console.log(assets, '!!!!!');
    if (assets.length)
      Promise.all(
        assets.map(async (asset) => {
          if (asset.endsWith(audioType)) {
            const ado = new Audio();
            ado.src = asset;
            return new Promise((res) => {
              ado.oncanplay = () => res(true);
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
  console.log(load);
  return load ? (
    children
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

export default Assets;
