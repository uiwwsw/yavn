import { AnimatePresence, motion } from 'framer-motion';
import { memo, ReactNode, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Assets, SentenceData, SentenceEntry } from '../utils/novelTypes';
import { getTypingSoundGenerator } from '../utils/typingSoundGenerator';

interface AssetEntry {
  name: string;
  index: number;
  key: string;
  animation?: import('../utils/novelTypes').VisualAnimation;
  layout?: import('../utils/novelTypes').VisualLayout;
  duration?: number;
  delay?: number;
  style?: import('react').CSSProperties;
  className?: string;
}

export interface SentenceProps {
  assets?: Assets;
  data?: SentenceData;
  direct?: boolean;
  isComplete: boolean;
  onComplete: () => void;
  prefix?: ReactNode;
  onProgress?: (cursor: number) => void;
  className?: string;
  showCursor?: boolean;
}

const defaultDuration = 70;

const clampMs = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getSpeechDelayMs = (baseMs: number, lastChar: string | undefined) => {
  const base = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : defaultDuration;
  const jitter = Math.round((Math.random() * 0.3 - 0.12) * base);

  if (!lastChar) return clampMs(base + jitter, 10, 220);

  if (lastChar === ' ') return clampMs(Math.round(base * 0.35) + jitter, 10, 140);
  if (lastChar === '\n') return clampMs(Math.round(base * 1.2) + jitter, 10, 260);

  if (/[.?!]/.test(lastChar)) return clampMs(Math.round(base * 4.2) + jitter, 40, 520);
  if (/[,]/.test(lastChar)) return clampMs(Math.round(base * 2.0) + jitter, 20, 360);
  if (/[;:]/.test(lastChar)) return clampMs(Math.round(base * 2.4) + jitter, 20, 380);
  if (/[”"']/u.test(lastChar)) return clampMs(Math.round(base * 0.75) + jitter, 10, 240);
  if (/[…]/u.test(lastChar)) return clampMs(Math.round(base * 3.0) + jitter, 30, 520);

  return clampMs(base + jitter, 10, 260);
};

const Sentence = ({
  assets,
  data,
  direct,
  isComplete: isCompleteProp,
  onComplete,
  prefix,
  onProgress,
  className,
  showCursor = true,
}: SentenceProps) => {
  const [_sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [_cursor, setCursor] = useState<number>(0);
  // Preload image assets to ensure quick display even for short dialogues
  const [preloadedImages, setPreloadedImages] = useState<Record<string, boolean>>({});
  const [_step, setStep] = useState<number>(-1);

  const step = Math.min(_step, _sentences.length);

  const isComplete = useMemo(() => {
    if (_sentences.length === 0) return false;
    return _step >= _sentences.length;
  }, [_sentences.length, _step]);

  const cursor = isCompleteProp || isComplete ? Number.POSITIVE_INFINITY : _cursor;

  const sentence = _sentences[step] ?? { message: '', duration: 0 };
  const baseDuration = sentence.duration ?? defaultDuration;

  const renderedSentence = useMemo<ReactNode>(() => {
    const nodes: ReactNode[] = [];

    for (let index = 0; index < _sentences.length; index += 1) {
      if (!isCompleteProp && step < index) break;

      const entry = _sentences[index];

      if (index > 0) nodes.push(' ');

      if (index < step) {
        nodes.push(entry.message);
        continue;
      }

      if (index === step) {
        const visible = entry.message.substring(0, cursor);
        if (!visible) continue;

        const prefix = visible.slice(0, -1);
        const last = visible.slice(-1);

        if (prefix) nodes.push(prefix);
        nodes.push(
          <span key={`pop-${index}-${visible.length}`} className="dialogue-pop">
            {last}
          </span>,
        );
        continue;
      }

      nodes.push(entry.message);
    }

    return <>{nodes}</>;
  }, [_sentences, cursor, isCompleteProp, step]);

  const assetArray = useMemo<AssetEntry[]>(() => {
    const entries = _sentences.flatMap((sentenceEntry, index) => {
      const results: AssetEntry[] = [];

      // Legacy support
      if (sentenceEntry.asset) {
        const assetNames = Array.isArray(sentenceEntry.asset) ? sentenceEntry.asset : [sentenceEntry.asset];
        assetNames.forEach((name, assetIndex) => {
          results.push({ name, index, key: `${index}-${assetIndex}-${name}`, layout: 'sticker' });
        });
      }

      // New Visuals support
      if (sentenceEntry.visuals) {
        sentenceEntry.visuals.forEach((visual, vIndex) => {
          results.push({
            name: visual.asset,
            index,
            key: `${index}-v${vIndex}-${visual.asset}`,
            animation: visual.animation,
            layout: visual.layout,
            duration: visual.duration,
            delay: visual.delay,
            style: visual.style,
            className: visual.className
          });
        });
      }

      return results;
    });

    if (isCompleteProp) return entries;

    const currentIndex = Math.min(Math.max(step, 0), _sentences.length - 1);
    return entries.filter((entry) => entry.index === currentIndex);
  }, [_sentences, step, isCompleteProp]);

  // Preload currently referenced asset images
  useEffect(() => {
    const toLoad = assetArray
      .map((a) => assets?.[a.name]?.image)
      .filter((src): src is string => typeof src === 'string');
    toLoad.forEach((src) => {
      if (preloadedImages[src]) return;
      const img = new Image();
      const onDone = () => setPreloadedImages((p) => ({ ...p, [src]: true }));
      img.onload = onDone;
      img.onerror = onDone;
      img.src = src;
    });
  }, [assetArray, assets, preloadedImages]);

  const isEndCursor = step < _sentences.length && sentence.message.length <= cursor;


  useEffect(() => {
    if (!data) {
      setSentences([]);
      setStep(-1);
      setCursor(0);
      return;
    }

    if (Array.isArray(data)) {
      setSentences(data);
    } else if (typeof data === 'object') {
      setSentences([data]);
    } else {
      setSentences([{ message: data, duration: defaultDuration }]);
    }

    setStep(0);
    setCursor(0);
    hasCalledComplete.current = false;
  }, [data]);

  const hasCalledComplete = useRef(false);

  useEffect(() => {
    if (step < 0) return;
    setCursor(0);
  }, [step]);

  useEffect(() => {
    if (isCompleteProp || isComplete) return;

    const message = sentence.message;
    if (!message) return;
    if (_cursor >= message.length) return;

    const lastChar = _cursor > 0 ? message[_cursor - 1] : undefined;
    const delayMs = getSpeechDelayMs(baseDuration, lastChar);

    const timeout = window.setTimeout(() => {
      // 타자 사운드 재생
      const typingSoundGenerator = getTypingSoundGenerator();
      typingSoundGenerator.playMechanicalKey();

      setCursor((prev) => prev + 1);
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [baseDuration, isComplete, isCompleteProp, _cursor, sentence.message]);

  useEffect(() => {
    onProgress?.(_cursor);
  }, [_cursor, onProgress]);


  useEffect(() => {
    if (!isEndCursor) return;
    setStep((prev) => (prev >= _sentences.length ? prev : prev + 1));
  }, [_sentences.length, isEndCursor]);

  useEffect(() => {
    if (isComplete && !isCompleteProp && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onComplete();
    }
  }, [isComplete, isCompleteProp, onComplete]);

  const [rootBounds, setRootBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;

    const update = () => {
      const rect = root.getBoundingClientRect();
      setRootBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  return (
    <>
      {assets && assetArray && (
        <>
          {assetArray.map(({ name, key }) => {
            const asset = assets[name];
            if (!asset?.audio) return null;
            return <audio key={`audio-${key}`} src={asset.audio} autoPlay />;
          })}

          {typeof document !== 'undefined' &&
            rootBounds &&
            createPortal(
              <div
                className="pointer-events-none"
                style={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  width: '100vw',
                  height: '100vh',
                  overflow: 'hidden',
                }}
              >
                <AnimatePresence mode="popLayout">
                  {assetArray.map(({ name, key, animation: overrideAnim, layout: itemLayout, duration, delay, style: overrideStyle, className }, index) => {
                    const asset = assets[name];
                    if (!asset) return null;

                    const animType = overrideAnim || asset.animation || 'fade-in';
                    const layoutType = itemLayout || 'root'; // NEW Default: Match Root Size
                    const customStyle = { ...asset.style, ...overrideStyle };
                    const customClass = `${asset.className || ''} ${className || ''}`;
                    // --- Layout Logic ---
                    let layoutStyle: CSSProperties = {
                    };
                    let baseTransform = '';

                    // Sticker Layout (Legacy Bottom Row)
                    if (layoutType === 'sticker') {
                      const size = rootBounds.width < 520 ? 56 : 72;
                      const gap = 10;
                      // Only count "sticker" items for spacing to avoid gaps from full-screen effects
                      const stickerIndex = assetArray
                        .filter(a => (a.layout || 'root') === 'sticker' && a.index === assetArray[index].index)
                        .findIndex(a => a.key === key);

                      const base = 18 + (stickerIndex >= 0 ? stickerIndex : 0) * (size + gap);

                      layoutStyle = {
                        bottom: 96,
                        width: size,
                        height: size,
                        left: direct ? undefined : rootBounds.left + base,
                        right: direct ? rootBounds.left + base : undefined,
                      };
                    }
                    // Root Layout (Matches #root container exactly)
                    else if (layoutType === 'root') {
                      layoutStyle = {

                        left: '50%',
                        top: '50%',
                        width: rootBounds?.width ?? '100%',
                        height: rootBounds?.height ?? '100%',
                        zIndex: 0,
                      };
                      baseTransform = 'translate(-50%, -50%)';
                    }
                    // Center Layout (Items, Important Objects)
                    else if (layoutType === 'center') {
                      layoutStyle = {
                        left: '50%',
                        top: '50%',
                        width: 'auto',
                        height: 'auto',
                        maxWidth: '80vw',
                        maxHeight: '60vh',
                        zIndex: 10001,
                      };
                      baseTransform = 'translate(-50%, -50%)';
                    }
                    // Full Screen Stretch (Backgrounds, Flashes)
                    else if (layoutType === 'stretch') {
                      layoutStyle = {
                        left: 0,
                        top: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 10000,
                      };
                    }
                    // Fit Screen (Characters, Portraits)
                    else if (layoutType === 'fit') {
                      layoutStyle = {
                        left: '50%',
                        bottom: 0,
                        height: '80vh',
                        width: 'auto',
                        zIndex: 10000,
                      };
                      baseTransform = 'translateX(-50%)';
                    }

                    const containerStyle: CSSProperties = {
                      position: 'absolute',
                      ...layoutStyle,
                      ...customStyle, // Apply User Overrides LAST
                    };

                    // --- Animation Logic ---
                    const variants = {
                      initial: { opacity: 0, scale: 0.85, y: 10, rotate: direct ? 2 : -2, x: 0 },
                      animate: { opacity: 1, scale: 1, y: 0, rotate: 0, x: 0 },
                      exit: { opacity: 0, scale: 0.92, y: 8 },

                      'slide-in-left': { initial: { x: -100, opacity: 0 }, animate: { x: 0, opacity: 1 } },
                      'slide-in-right': { initial: { x: 100, opacity: 0 }, animate: { x: 0, opacity: 1 } },
                      'zoom-in': { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 } },
                      'shake': { animate: { x: [-5, 5, -5, 5, 0], transition: { duration: 0.5 } } },
                      'pulse': { animate: { scale: [1, 1.1, 1], transition: { duration: 1.5 } } },
                      'float': { animate: { y: [0, -15, 0], transition: { duration: 3, ease: "easeInOut" } } },
                      'flash': { animate: { opacity: [0, 1, 0, 1, 0] } },
                      'none': { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } },

                      // New Effects
                      'fade-in-slow': { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 2.0 } } },
                      'fade-out-slow': { exit: { opacity: 0, transition: { duration: 2.0 } } },
                      'impact': { initial: { scale: 2.5, opacity: 0 }, animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 15 } } },
                      'shake-hard': { animate: { x: [-10, 10, -8, 8, -5, 5, 0], y: [-5, 5, -3, 3, 0], transition: { duration: 0.5 } } },
                      'move-left-right': { initial: { x: '-10%', opacity: 0 }, animate: { x: ['-10%', '110%'], opacity: 1, transition: { x: { duration: 5, ease: 'linear' }, opacity: { duration: 0.5 } } } }
                    };

                    let initial: any = variants.initial;
                    let animate: any = variants.animate;
                    let exit: any = variants.exit;

                    if (animType === 'slide-in-left') { initial = variants['slide-in-left'].initial; animate = variants['slide-in-left'].animate; }
                    if (animType === 'slide-in-right') { initial = variants['slide-in-right'].initial; animate = variants['slide-in-right'].animate; }
                    if (animType === 'zoom-in') { initial = variants['zoom-in'].initial; animate = variants['zoom-in'].animate; }
                    if (animType === 'flash') { initial = { opacity: 0 }; animate = variants['flash'].animate; exit = { opacity: 0 }; }
                    if (animType === 'none') { initial = variants['none'].initial; animate = variants['none'].animate; exit = variants['none'].exit; }

                    // New Logic
                    if (animType === 'fade-in-slow') { initial = variants['fade-in-slow'].initial; animate = { ...animate, ...variants['fade-in-slow'].animate }; }
                    if (animType === 'fade-out-slow') { exit = variants['fade-out-slow'].exit; }
                    if (animType === 'impact') { initial = variants['impact'].initial; animate = variants['impact'].animate; }
                    if (animType === 'move-left-right') { initial = variants['move-left-right'].initial; animate = variants['move-left-right'].animate; }

                    if (animType === 'shake') { animate = { ...animate, ...variants['shake'].animate }; }
                    if (animType === 'shake-hard') { animate = { ...animate, ...variants['shake-hard'].animate }; }
                    if (animType === 'pulse') { animate = { ...animate, ...variants['pulse'].animate }; }
                    if (animType === 'float') { animate = { ...animate, ...variants['float'].animate }; }


                    // --- Content Rendering ---
                    // "Sticker" gets the card look, everything else is transparent/raw
                    const isSticker = layoutType === 'sticker';

                    return (
                      <motion.div
                        key={`sticker-${key}`}
                        style={containerStyle}
                        className={customClass}
                        transformTemplate={baseTransform ? (_, generated) => `${baseTransform} ${generated}` : undefined}
                        initial={initial}
                        animate={animate}
                        exit={exit}
                        transition={{
                          opacity: { duration: 0.18, ease: 'easeOut' },
                          scale: { type: 'spring', stiffness: 260, damping: 18 },
                          y: { type: 'spring', stiffness: 240, damping: 20 },
                          duration: duration ? duration / 1000 : undefined,
                          delay: delay ? delay / 1000 : undefined,
                        }}
                      >
                        {/* Only apply the card wrapper for stickers */}
                        {isSticker ? (
                          <div className="h-full w-full rounded-xl border border-white/10 bg-black/25 p-1 shadow-2xl shadow-black/60 backdrop-blur">
                            {asset.image && (preloadedImages[asset.image] ? (
                              <img className="h-full w-full object-contain" src={asset.image} alt="" />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.08)' }} />
                            ))}
                          </div>
                        ) : (
                          // For screen/center/fit layers, just render the content directly
                          <div className="w-full h-full flex items-center justify-center">
                            {asset.image && (
                              <img
                                src={asset.image}
                                className="object-cover"
                                // If it's a 'stretch' layout (like a flash bang), fill the container
                                style={layoutType === 'stretch' ? { width: '100%', height: '100%', objectFit: 'cover' } : {}}
                              />
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>,
              document.body,
            )}
        </>
      )}
      <span className={`whitespace-pre-line leading-relaxed${className ? ` ${className}` : ''}`}>
        {prefix}
        {renderedSentence}
        {!isCompleteProp && !isComplete && showCursor && <span className="terminal-cursor has-prefix">▍</span>}
      </span>
    </>
  );
};

export default memo(Sentence);
