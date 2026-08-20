import { memo, useEffect, useRef, useState } from 'react';
import {
  BACKGROUND_CROSSFADE_DURATION_MS,
  EMPTY_BACKGROUND_TRANSITION,
  collectBackgroundLayerSources,
  commitPreparedBackground,
  finishBackgroundTransition,
} from './assetTransition';
import { waitForImageReady } from './imageReady';

const BACKGROUND_READY_TIMEOUT_MS = 12000;
// React 18 forwards the standards-based lowercase attribute without warning.
const HIGH_PRIORITY_IMAGE_PROPS = { fetchpriority: 'high' } as const;

export const BackgroundTransition = memo(function BackgroundTransition({ source }: { source?: string }) {
  const [presentation, setPresentation] = useState(EMPTY_BACKGROUND_TRANSITION);
  const pendingImageRef = useRef<HTMLImageElement | null>(null);
  const latestSourceRef = useRef(source);
  latestSourceRef.current = source;

  useEffect(() => {
    if (!source) {
      setPresentation((previous) => (
        previous.current || previous.previous
          ? { ...EMPTY_BACKGROUND_TRANSITION, revision: previous.revision + 1 }
          : previous
      ));
      return;
    }
    if (presentation.current === source) {
      return;
    }

    const image = pendingImageRef.current;
    if (!image) {
      return;
    }
    let cancelled = false;
    let commitFrame: number | undefined;

    void waitForImageReady(image, BACKGROUND_READY_TIMEOUT_MS).then((status) => {
      if (cancelled || status !== 'ready' || latestSourceRef.current !== source) {
        return;
      }
      // Let the hidden pending layer establish opacity: 0 before promoting the
      // same keyed DOM node. This makes cached images transition consistently.
      commitFrame = window.requestAnimationFrame(() => {
        if (cancelled || latestSourceRef.current !== source) {
          return;
        }
        setPresentation((previous) => commitPreparedBackground(previous, source));
      });
    });

    return () => {
      cancelled = true;
      if (commitFrame !== undefined) {
        window.cancelAnimationFrame(commitFrame);
      }
    };
  }, [presentation.current, source]);

  useEffect(() => {
    if (!presentation.current || !presentation.previous) {
      return;
    }
    const currentSource = presentation.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timer = window.setTimeout(
      () => setPresentation((previous) => finishBackgroundTransition(previous, currentSource)),
      reducedMotion ? 0 : BACKGROUND_CROSSFADE_DURATION_MS + 40,
    );
    return () => window.clearTimeout(timer);
  }, [presentation.current, presentation.previous, presentation.revision]);

  const layers = collectBackgroundLayerSources(presentation, source);
  return (
    <>
      {layers.map((layerSource) => {
        const pending = layerSource === source && layerSource !== presentation.current;
        const role = pending
          ? 'pending'
          : layerSource === presentation.current
            ? 'current'
            : 'previous';
        const transitioning = presentation.previous !== undefined
          && (role === 'current' || role === 'previous');
        return (
          <img
            {...HIGH_PRIORITY_IMAGE_PROPS}
            key={layerSource}
            ref={pending ? pendingImageRef : undefined}
            className={`bg bg-${role}`}
            src={layerSource}
            alt="background"
            aria-hidden="true"
            data-background-role={role}
            data-background-transitioning={transitioning ? 'true' : 'false'}
            loading="eager"
            decoding="async"
          />
        );
      })}
    </>
  );
});
