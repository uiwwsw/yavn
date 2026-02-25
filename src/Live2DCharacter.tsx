import { useEffect, useRef, useState } from 'react';
import type { CharacterSlot, Position } from './types';

const PIXI_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js';
const LIVE2D_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js';

type Live2DModelInstance = {
  width: number;
  height: number;
  x: number;
  y: number;
  anchor?: { set: (x: number, y: number) => void };
  scale: { set: (v: number) => void };
  motion?: (group: string, index?: number) => void;
  expression?: (id: string) => void;
  destroy?: () => void;
};

type PixiApplication = {
  view: HTMLCanvasElement;
  renderer: { resize: (w: number, h: number) => void };
  stage: { addChild: (child: unknown) => void };
  destroy: (removeView?: boolean, stageOptions?: { children?: boolean; texture?: boolean; baseTexture?: boolean }) => void;
};

type Live2DRuntime = {
  PIXI?: {
    Application?: new (options: Record<string, unknown>) => PixiApplication;
    live2d?: {
      Live2DModel?: {
        from: (url: string) => Promise<Live2DModelInstance>;
      };
    };
  };
};

const scriptCache = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  const cached = scriptCache.get(src);
  if (cached) {
    return cached;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  scriptCache.set(src, promise);
  return promise;
}

async function ensureRuntime() {
  await loadScriptOnce(PIXI_SCRIPT_URL);
  await loadScriptOnce(LIVE2D_SCRIPT_URL);
}

function getRuntime(): Live2DRuntime {
  return window as unknown as Live2DRuntime;
}

function applyEmotion(model: Live2DModelInstance, emotion?: string) {
  if (!emotion) {
    return;
  }
  try {
    if (typeof model.expression === 'function') {
      model.expression(emotion);
      return;
    }
  } catch {
    // Keep default expression when specific id is not available.
  }
  try {
    if (typeof model.motion === 'function') {
      model.motion(emotion, 0);
    }
  } catch {
    // Keep idle motion when group is not available.
  }
}

type Props = {
  slot: CharacterSlot;
  position: Position;
};

export function Live2DCharacter({ slot, position }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let app: PixiApplication | undefined;
    let model: Live2DModelInstance | undefined;
    let cleanupLayout: (() => void) | undefined;

    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const render = async () => {
      try {
        await ensureRuntime();
        if (cancelled) {
          return;
        }

        const runtime = getRuntime();
        const AppCtor = runtime.PIXI?.Application;
        const Live2DModel = runtime.PIXI?.live2d?.Live2DModel;
        if (!AppCtor || !Live2DModel) {
          throw new Error('Live2D runtime not available');
        }

        app = new AppCtor({
          width: Math.max(mount.clientWidth, 1),
          height: Math.max(mount.clientHeight, 1),
          transparent: true,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
        });
        mount.innerHTML = '';
        mount.appendChild(app.view);

        model = await Live2DModel.from(slot.source);
        if (cancelled || !model) {
          return;
        }
        app.stage.addChild(model);

        const layout = () => {
          if (!app || !model || !mountRef.current) {
            return;
          }
          const width = Math.max(mountRef.current.clientWidth, 1);
          const height = Math.max(mountRef.current.clientHeight, 1);
          app.renderer.resize(width, height);

          if (typeof model.anchor?.set === 'function') {
            model.anchor.set(0.5, 1);
          }
          const fitScale = Math.min((width * 0.8) / Math.max(model.width, 1), (height * 0.9) / Math.max(model.height, 1));
          const scale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
          model.scale.set(scale);
          model.x = width / 2;
          model.y = height * 0.98;
        };

        layout();
        window.addEventListener('resize', layout);
        applyEmotion(model, slot.emotion);

        setError(undefined);

        cleanupLayout = () => {
          window.removeEventListener('resize', layout);
        };
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Live2D load failed');
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      cleanupLayout?.();
      if (model?.destroy) {
        model.destroy();
      }
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [slot.source, slot.emotion]);

  return (
    <div className={`char char-live2d ${position}`}>
      <div ref={mountRef} className="char-live2d-mount" />
      {error && <div className="char-live2d-error">{error}</div>}
    </div>
  );
}
