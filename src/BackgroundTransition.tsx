import { memo, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BACKGROUND_CROSSFADE_DURATION_MS,
  EMPTY_BACKGROUND_TRANSITION,
  collectBackgroundLayerSources,
  commitPreparedBackground,
  finishBackgroundTransition,
} from './assetTransition';
import type { BackgroundTransitionKind } from './types';
import { waitForImageReadyWhenVisible } from './imageReady';
import { ResourceImage } from './ResourceImage';

const BACKGROUND_READY_TIMEOUT_MS = 12000;
// React 18 forwards the standards-based lowercase attribute without warning.
const HIGH_PRIORITY_IMAGE_PROPS = { fetchpriority: 'high' } as const;

const EMPTY_PRESENTATION = {
  ...EMPTY_BACKGROUND_TRANSITION,
  durationMs: 0,
  easing: 'ease',
  kind: 'cut' as BackgroundTransitionKind,
  requestRevision: 0,
};

export const BackgroundTransition = memo(function BackgroundTransition({
  source,
  durationMs = BACKGROUND_CROSSFADE_DURATION_MS,
  easing = 'cubic-bezier(0.2, 0.72, 0.24, 1)',
  kind = 'dissolve',
  requestRevision = 0,
  onComplete,
}: {
  source?: string;
  durationMs?: number;
  easing?: string;
  kind?: BackgroundTransitionKind;
  requestRevision?: number;
  onComplete?: (revision: number, ok?: boolean) => void;
}) {
  const [presentation, setPresentation] = useState(EMPTY_PRESENTATION);
  const pendingImageRef = useRef<HTMLImageElement | null>(null);
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  const latestRequestRef = useRef({ source, requestRevision });
  const completionRef = useRef(onComplete);
  completionRef.current = onComplete;
  latestRequestRef.current = { source, requestRevision };

  useEffect(() => {
    if (!source) {
      setPresentation((previous) => (
        previous.current || previous.previous
          ? { ...EMPTY_PRESENTATION, revision: previous.revision + 1 }
          : previous
      ));
      return;
    }
    if (presentation.current === source) {
      // Returning to a still-painted source can supersede an undecoded request.
      if (presentation.requestRevision !== requestRevision) completionRef.current?.(requestRevision);
      return;
    }

    const image = pendingImageRef.current;
    if (!image) {
      return;
    }
    let cancelled = false;
    let commitFrame: number | undefined;
    const isLatestRequest = () => latestRequestRef.current.source === source
      && latestRequestRef.current.requestRevision === requestRevision;

    void waitForImageReadyWhenVisible(image, BACKGROUND_READY_TIMEOUT_MS).then((status) => {
      if (cancelled || !isLatestRequest()) return;
      if (status !== 'ready') {
        completionRef.current?.(requestRevision, false);
        return;
      }
      // Let the hidden pending layer establish opacity: 0 before promoting the
      // same keyed DOM node. This makes cached images transition consistently.
      commitFrame = window.requestAnimationFrame(() => {
        if (cancelled || !isLatestRequest()) return;
        setPresentation((previous) => {
          const next = commitPreparedBackground(previous, source);
          return {
            ...next,
            previous: kind === 'cut' ? undefined : next.previous,
            durationMs,
            easing,
            kind,
            requestRevision,
          };
        });
      });
    });

    return () => {
      cancelled = true;
      if (commitFrame !== undefined) {
        window.cancelAnimationFrame(commitFrame);
      }
    };
  }, [presentation.current, presentation.requestRevision, source, durationMs, easing, kind, requestRevision]);

  useEffect(() => {
    const currentSource = presentation.current;
    if (!currentSource) return;
    const image = currentImageRef.current;
    const effectLevel = image?.closest('[data-effect-level]')?.getAttribute('data-effect-level');
    const motionDisabled = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || effectLevel === 'minimal'
      || (effectLevel === 'reduced' && presentation.kind !== 'dissolve');
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      setPresentation((previous) => previous.revision === presentation.revision
        ? finishBackgroundTransition(previous, currentSource)
        : previous);
      if (latestRequestRef.current.source === currentSource
        && latestRequestRef.current.requestRevision === presentation.requestRevision) {
        completionRef.current?.(presentation.requestRevision);
      }
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (presentation.kind === 'dissolve' && event.propertyName === 'opacity') finish();
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (/^scene(?:FadeIn|WipeLeft|WipeRight)$/.test(event.animationName)) finish();
    };
    if (motionDisabled || !presentation.previous || presentation.durationMs === 0) {
      finish();
      return;
    }
    image?.addEventListener('transitionend', onTransitionEnd);
    image?.addEventListener('animationend', onAnimationEnd);
    const timer = window.setTimeout(finish, presentation.durationMs + 48);
    return () => {
      window.clearTimeout(timer);
      image?.removeEventListener('transitionend', onTransitionEnd);
      image?.removeEventListener('animationend', onAnimationEnd);
    };
    // Only a newly promoted image starts a completion cycle.
  }, [presentation.revision]);

  const layers = collectBackgroundLayerSources(presentation, source);
  return (
    <>
      {layers.map((layerSource) => {
        const pending = layerSource === source && layerSource !== presentation.current;
        const role = layerSource === presentation.current
          ? 'current'
          : layerSource === presentation.previous ? 'previous' : 'pending';
        const transitioning = presentation.previous !== undefined
          && (role === 'current' || role === 'previous');
        return (
          <ResourceImage
            {...HIGH_PRIORITY_IMAGE_PROPS}
            key={layerSource}
            ref={role === 'current' ? currentImageRef : pending ? pendingImageRef : undefined}
            className={`bg bg-${role}`}
            src={layerSource}
            alt="background"
            aria-hidden="true"
            data-background-role={role}
            data-background-kind={presentation.kind}
            data-background-transitioning={transitioning ? 'true' : 'false'}
            loading="eager"
            decoding="async"
            style={{
              '--background-crossfade-duration': `${presentation.durationMs}ms`,
              '--background-crossfade-easing': presentation.easing,
            } as CSSProperties}
          />
        );
      })}
    </>
  );
});
