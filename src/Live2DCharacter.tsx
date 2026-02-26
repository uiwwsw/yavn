import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createModelView, startup, Ticker } from 'easy-cl2d';
import { markLive2DLoadError, markLive2DLoadReady } from './live2dLoadTracker';
import type { CharacterSlot, Position } from './types';

const CUBISM_CORE_SCRIPT_URL = '/vendor/live2d/live2dcubismcore.min.js?v=5-r.5-beta.3.1';

type Live2DCoreRuntime = {
  Live2DCubismCore?: unknown;
};

type Live2DCoreModelFactory = {
  fromMoc?: (...args: unknown[]) => unknown;
};

type Live2DCoreModelInstance = {
  drawables?: {
    count?: number;
    renderOrders?: unknown;
  };
  getRenderOrders?: () => unknown;
};

type Live2DModelFileReferences = {
  Moc?: string;
  Physics?: string;
  Pose?: string;
  UserData?: string;
  DisplayInfo?: string;
  Textures?: string[];
  Expressions?: Array<Record<string, unknown>>;
  Motions?: Record<string, Array<Record<string, unknown>>>;
};

type Live2DModelJson = {
  FileReferences?: Live2DModelFileReferences;
};

type Live2DModelSourceInfo = {
  modelUrl: string;
  directory: string;
  fileName: string;
  protocol: string;
};

type Live2DViewModel = {
  setExpression?: (id: string) => void;
  startRandomMotion?: (group: string, priority: number) => void;
};

type Live2DPointerView = {
  onTouchBegan: (pointX: number, pointY: number) => void;
  onTouchMove: (pointX: number, pointY: number) => void;
  onTouchEnd: (pointX: number, pointY: number) => void;
};

type Live2DPointerSubdelegate = {
  canvas: HTMLCanvasElement;
  _view?: Live2DPointerView | null;
  _captured?: boolean;
  onPointerDown?: (pageX: number, pageY: number) => void;
  onPointerMove?: (pageX: number, pageY: number) => void;
  onPointerUp?: (pageX: number, pageY: number) => void;
  onTouchCancel?: (pageX: number, pageY: number) => void;
  __yavnPointerPatched?: boolean;
};

type Live2DInternalModel = Live2DViewModel & {
  _state?: number;
  _textureCount?: number;
  _modelHomeDir?: string;
  _modelSetting?: {
    getTextureCount?: () => number;
  };
  _subdelegate?: Live2DPointerSubdelegate;
};

type Live2DViewHandle = {
  inner: Live2DViewModel;
  resizeCanvas: (width: number, height: number) => void;
  [Symbol.dispose]: () => void;
};

type PromiseWithResolversFactory = <T>() => {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const scriptCache = new Map<string, Promise<void>>();
let runtimeStarted = false;
let cubismCoreCompatPatched = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeFetchUrl(raw: string): string {
  if (/^\/(https?:|blob:|data:)/i.test(raw)) {
    return raw.slice(1);
  }
  return raw;
}

const live2dFetch: typeof fetch = (input, init) => {
  if (typeof input === 'string') {
    return fetch(normalizeFetchUrl(input), init);
  }

  if (input instanceof URL) {
    return fetch(normalizeFetchUrl(input.toString()), init);
  }

  if (input instanceof Request) {
    return fetch(new Request(normalizeFetchUrl(input.url), input), init);
  }

  return fetch(input, init);
};

function ensurePromiseWithResolversPolyfill(): void {
  const promiseCtor = Promise as PromiseConstructor & {
    withResolvers?: PromiseWithResolversFactory;
  };
  if (typeof promiseCtor.withResolvers === 'function') {
    return;
  }
  promiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

function patchCubismCoreCompatForEasyCl2D(): void {
  if (cubismCoreCompatPatched) {
    return;
  }

  const core = (window as unknown as Live2DCoreRuntime).Live2DCubismCore;
  if (!isRecord(core)) {
    return;
  }

  const modelFactory = core.Model as Live2DCoreModelFactory | undefined;
  if (!modelFactory || typeof modelFactory.fromMoc !== 'function') {
    return;
  }

  const originalFromMoc = modelFactory.fromMoc;
  modelFactory.fromMoc = function fromMocWithCompat(...args: unknown[]) {
    const model = originalFromMoc.apply(this, args) as Live2DCoreModelInstance | null;
    if (!model) {
      return model;
    }

    const drawables = model.drawables;
    if (!drawables) {
      return model;
    }

    if (drawables.renderOrders instanceof Int32Array) {
      return model;
    }

    if (typeof model.getRenderOrders !== 'function') {
      return model;
    }

    const renderOrders = model.getRenderOrders();
    if (!(renderOrders instanceof Int32Array)) {
      return model;
    }

    const drawableCount = typeof drawables.count === 'number' && drawables.count > 0 ? drawables.count : renderOrders.length;
    drawables.renderOrders = drawableCount <= renderOrders.length ? renderOrders.subarray(0, drawableCount) : renderOrders;
    return model;
  };

  cubismCoreCompatPatched = true;
}

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
  }).catch((error: unknown) => {
    scriptCache.delete(src);
    throw error;
  });

  scriptCache.set(src, promise);
  return promise;
}

async function ensureRuntime(): Promise<void> {
  ensurePromiseWithResolversPolyfill();
  const runtime = window as unknown as Live2DCoreRuntime;
  if (!runtime.Live2DCubismCore) {
    await loadScriptOnce(CUBISM_CORE_SCRIPT_URL);
  }

  if (!(window as unknown as Live2DCoreRuntime).Live2DCubismCore) {
    throw new Error('Live2D Cubism Core not available');
  }

  patchCubismCoreCompatForEasyCl2D();

  if (!runtimeStarted) {
    startup({
      log: () => undefined,
      logLevel: 'off',
    });
    runtimeStarted = true;
  }
}

function splitModelSource(modelSource: string): Live2DModelSourceInfo {
  const normalized = normalizeFetchUrl(modelSource.trim());
  if (!normalized) {
    throw new Error('Model URL is empty');
  }

  if (/^blob:/i.test(normalized)) {
    const slashIndex = normalized.lastIndexOf('/');
    if (slashIndex <= 5 || slashIndex >= normalized.length - 1) {
      throw new Error('Invalid blob model URL');
    }
    return {
      modelUrl: normalized,
      directory: normalized.slice(0, slashIndex),
      fileName: normalized.slice(slashIndex + 1),
      protocol: 'blob:',
    };
  }

  const parsed = new URL(normalized, window.location.href);
  const url = parsed.toString();
  const slashIndex = url.lastIndexOf('/');
  if (slashIndex < 0 || slashIndex >= url.length - 1) {
    throw new Error(`Invalid model URL: ${normalized}`);
  }

  return {
    modelUrl: url,
    directory: url.slice(0, slashIndex),
    fileName: url.slice(slashIndex + 1),
    protocol: parsed.protocol,
  };
}

function relativizeModelJsonByDirectory(directory: string, source: Live2DModelJson): Live2DModelJson {
  const cloned = structuredClone(source) as Live2DModelJson;
  const refs = cloned.FileReferences;
  if (!refs) {
    return cloned;
  }

  const relativize = (raw?: string): string | undefined => {
    if (!raw || typeof raw !== 'string') {
      return undefined;
    }
    const normalized = normalizeFetchUrl(raw);
    const prefix = `${directory}/`;
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
    return normalized;
  };

  type ScalarRefKey = 'Moc' | 'Physics' | 'Pose' | 'UserData' | 'DisplayInfo';
  const rewriteScalar = (key: ScalarRefKey) => {
    const current = refs[key];
    if (typeof current !== 'string') {
      return;
    }
    const rewritten = relativize(current);
    if (rewritten) {
      refs[key] = rewritten;
    }
  };

  rewriteScalar('Moc');
  rewriteScalar('Physics');
  rewriteScalar('Pose');
  rewriteScalar('UserData');
  rewriteScalar('DisplayInfo');

  if (Array.isArray(refs.Textures)) {
    refs.Textures = refs.Textures.map((entry) => relativize(entry) ?? entry);
  }

  if (Array.isArray(refs.Expressions)) {
    refs.Expressions = refs.Expressions.map((entry) => {
      if (!isRecord(entry)) {
        return entry;
      }
      const next = { ...entry };
      if (typeof next.File === 'string') {
        next.File = relativize(next.File) ?? next.File;
      }
      return next;
    });
  }

  if (isRecord(refs.Motions)) {
    const rewrittenMotions: Record<string, Array<Record<string, unknown>>> = {};
    for (const [group, value] of Object.entries(refs.Motions)) {
      if (!Array.isArray(value)) {
        continue;
      }
      rewrittenMotions[group] = value.map((entry) => {
        if (!isRecord(entry)) {
          return entry;
        }
        const next = { ...entry };
        if (typeof next.File === 'string') {
          next.File = relativize(next.File) ?? next.File;
        }
        if (typeof next.Sound === 'string') {
          next.Sound = relativize(next.Sound) ?? next.Sound;
        }
        return next;
      });
    }
    refs.Motions = rewrittenMotions;
  }

  return cloned;
}

function joinModelPath(directory: string, raw: string): string {
  const normalized = normalizeFetchUrl(raw.trim());
  if (/^(blob:|data:|https?:)/i.test(normalized)) {
    return normalized;
  }
  const relative = normalized.replace(/^\/+/, '');
  if (/^blob:/i.test(directory)) {
    return `${directory.replace(/\/+$/, '')}/${relative}`;
  }
  const base = directory.endsWith('/') ? directory : `${directory}/`;
  return new URL(relative, base).toString();
}

function probeImage(src: string, timeoutMs = 6000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      image.onabort = null;
    };
    image.onload = () => {
      cleanup();
      resolve(true);
    };
    image.onerror = () => {
      cleanup();
      resolve(false);
    };
    image.onabort = () => {
      cleanup();
      resolve(false);
    };
    image.decoding = 'async';
    image.src = src;
  });
}

async function loadModelDefinition(modelUrl: string): Promise<Live2DModelJson> {
  const response = await fetch(normalizeFetchUrl(modelUrl), { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Model JSON not reachable (HTTP ${response.status})`);
  }

  const parsed = (await response.json()) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Invalid model JSON');
  }

  return parsed as Live2DModelJson;
}

async function preflightModelAssets(directory: string, modelJson: Live2DModelJson): Promise<void> {
  const refs = modelJson.FileReferences;
  if (!refs) {
    throw new Error('model3.json missing FileReferences');
  }

  if (typeof refs.Moc === 'string') {
    const mocUrl = joinModelPath(directory, refs.Moc);
    const response = await fetch(normalizeFetchUrl(mocUrl), { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`MOC not reachable (HTTP ${response.status}): ${mocUrl}`);
    }
  }

  const firstTexture = Array.isArray(refs.Textures) ? refs.Textures[0] : undefined;
  if (typeof firstTexture === 'string') {
    const textureUrl = joinModelPath(directory, firstTexture);
    const ok = await probeImage(textureUrl);
    if (!ok) {
      throw new Error(`Texture failed to load: ${textureUrl}`);
    }
  }
}

function waitForModelReady(
  getModel: () => Live2DInternalModel | undefined,
  isCancelled: () => boolean,
  timeoutMs = 12000,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const startedAt = performance.now();
    const tick = () => {
      if (isCancelled()) {
        resolve(false);
        return;
      }
      const model = getModel();
      if (model?._state === 22) {
        resolve(true);
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

function resolveLocalPoint(pageX: number, pageY: number, canvas: HTMLCanvasElement): { x: number; y: number; inside: boolean } {
  const rect = canvas.getBoundingClientRect();
  const clientX = pageX - window.scrollX;
  const clientY = pageY - window.scrollY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
  return { x, y, inside };
}

function patchPointerMapping(model: Live2DInternalModel | undefined): void {
  const subdelegate = model?._subdelegate;
  if (!subdelegate || subdelegate.__yavnPointerPatched) {
    return;
  }

  subdelegate.onPointerDown = (pageX: number, pageY: number) => {
    const view = subdelegate._view;
    if (!view) {
      return;
    }
    const local = resolveLocalPoint(pageX, pageY, subdelegate.canvas);
    if (!local.inside) {
      subdelegate._captured = false;
      return;
    }
    subdelegate._captured = true;
    view.onTouchBegan(local.x, local.y);
  };

  subdelegate.onPointerMove = (pageX: number, pageY: number) => {
    if (!subdelegate._captured) {
      return;
    }
    const view = subdelegate._view;
    if (!view) {
      return;
    }
    const local = resolveLocalPoint(pageX, pageY, subdelegate.canvas);
    view.onTouchMove(local.x, local.y);
  };

  subdelegate.onPointerUp = (pageX: number, pageY: number) => {
    const captured = !!subdelegate._captured;
    subdelegate._captured = false;
    if (!captured) {
      return;
    }
    const view = subdelegate._view;
    if (!view) {
      return;
    }
    const local = resolveLocalPoint(pageX, pageY, subdelegate.canvas);
    view.onTouchEnd(local.x, local.y);
  };

  subdelegate.onTouchCancel = (pageX: number, pageY: number) => {
    const captured = !!subdelegate._captured;
    subdelegate._captured = false;
    if (!captured) {
      return;
    }
    const view = subdelegate._view;
    if (!view) {
      return;
    }
    const local = resolveLocalPoint(pageX, pageY, subdelegate.canvas);
    view.onTouchEnd(local.x, local.y);
  };

  subdelegate.__yavnPointerPatched = true;
}

function formatLoadError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return 'Live2D load failed';
}

function applyEmotion(model: Live2DViewModel | undefined, emotion?: string): void {
  if (!model || !emotion) {
    return;
  }

  const normalized = emotion.trim();
  if (!normalized) {
    return;
  }

  const isIdle = normalized.toLowerCase() === 'idle';

  if (isIdle && typeof model.startRandomMotion === 'function') {
    try {
      model.startRandomMotion('Idle', 1);
      return;
    } catch {
      // Continue to expression fallback.
    }
  }

  if (typeof model.setExpression === 'function') {
    try {
      model.setExpression(normalized);
      return;
    } catch {
      // Try motion fallback.
    }
  }

  if (typeof model.startRandomMotion === 'function') {
    try {
      model.startRandomMotion(normalized, 2);
    } catch {
      // Keep default state when emotion key doesn't match.
    }
  }
}

type Props = {
  slot: CharacterSlot;
  position: Position;
  trackingKey: string;
  className?: string;
  style?: CSSProperties;
};

export function Live2DCharacter({ slot, position, trackingKey, className, style }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<Live2DViewModel>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let ticker: Ticker | undefined;
    let modelView: Live2DViewHandle | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let detachResize: (() => void) | undefined;
    let stallTimer: number | undefined;

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

        const sourceInfo = splitModelSource(slot.source);
        const loadedModelJson = await loadModelDefinition(sourceInfo.modelUrl);
        if (cancelled) {
          return;
        }
        const modelJson =
          sourceInfo.protocol === 'blob:' ? relativizeModelJsonByDirectory(sourceInfo.directory, loadedModelJson) : loadedModelJson;
        const directory = sourceInfo.directory;
        const model3: string | Record<string, unknown> = sourceInfo.protocol === 'blob:' ? (modelJson as Record<string, unknown>) : sourceInfo.fileName;
        await preflightModelAssets(directory, modelJson);
        if (cancelled) {
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        mount.innerHTML = '';
        mount.appendChild(canvas);

        ticker = new Ticker();
        ticker.start();

        modelView = createModelView({
          canvas,
          ticker,
          model: {
            directory,
            model3,
          },
          fetch: live2dFetch,
          onIdle: ({ model }) => {
            try {
              model.startRandomMotion('Idle', 1);
            } catch {
              // Keep static pose when Idle is unavailable.
            }
          },
        }) as unknown as Live2DViewHandle;
        patchPointerMapping(modelView.inner as Live2DInternalModel | undefined);

        const resize = () => {
          if (!modelView || !mountRef.current) {
            return;
          }
          const widthCss = Math.max(mountRef.current.clientWidth, 1);
          const heightCss = Math.max(mountRef.current.clientHeight, 1);
          const dpr = Math.max(window.devicePixelRatio || 1, 1);
          const width = Math.max(Math.round(widthCss * dpr), 1);
          const height = Math.max(Math.round(heightCss * dpr), 1);
          modelView.resizeCanvas(width, height);
        };

        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        window.addEventListener('resize', resize);
        detachResize = () => window.removeEventListener('resize', resize);

        modelRef.current = modelView.inner;
        applyEmotion(modelRef.current, slot.emotion);
        setError(undefined);

        stallTimer = window.setTimeout(() => {
          const inner = modelView?.inner as Live2DInternalModel | undefined;
          if (!inner || inner._state === 22) {
            return;
          }
          const loadedTextureCount = typeof inner._textureCount === 'number' ? inner._textureCount : '?';
          const expectedTextureCount = inner._modelSetting?.getTextureCount?.();
          const expectedTextureLabel = typeof expectedTextureCount === 'number' ? expectedTextureCount : '?';
          const stateLabel = typeof inner._state === 'number' ? inner._state : '?';
          setError(`Live2D loading stalled (state=${stateLabel}, textures=${loadedTextureCount}/${expectedTextureLabel})`);
          markLive2DLoadError(trackingKey);
        }, 8000);

        const ready = await waitForModelReady(
          () => modelView?.inner as Live2DInternalModel | undefined,
          () => cancelled,
        );
        if (!ready || cancelled) {
          if (!cancelled) {
            markLive2DLoadError(trackingKey);
          }
          return;
        }
        markLive2DLoadReady(trackingKey);
      } catch (err) {
        if (!cancelled) {
          setError(formatLoadError(err));
          markLive2DLoadError(trackingKey);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      modelRef.current = undefined;
      resizeObserver?.disconnect();
      detachResize?.();
      if (stallTimer) {
        window.clearTimeout(stallTimer);
      }
      if (modelView) {
        try {
          modelView[Symbol.dispose]();
        } catch {
          // No-op cleanup fallback.
        }
      }
      ticker?.stop();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [slot.source, trackingKey]);

  useEffect(() => {
    applyEmotion(modelRef.current, slot.emotion);
  }, [slot.emotion]);

  return (
    <div className={`char char-live2d ${position}${className ? ` ${className}` : ''}`} style={style}>
      <div ref={mountRef} className="char-live2d-mount" />
      {error && <div className="char-live2d-error">{error}</div>}
    </div>
  );
}
