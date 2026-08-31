import { memo, useEffect, useRef, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { isImageSourceReady, waitForImageReady } from './imageReady';

const CHARACTER_IMAGE_READY_TIMEOUT_MS = 12000;

type StageImageCharacterProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  source: string;
  fetchpriority?: 'high' | 'low' | 'auto';
};

type ImagePresentation = {
  source: string;
  ready: boolean;
};

/**
 * Keeps the last decoded character on screen while a replacement source is prepared.
 * A character with no previous paint stays hidden until its first source is decoded.
 */
export const StageImageCharacter = memo(function StageImageCharacter({
  source,
  className = '',
  ...imageProps
}: StageImageCharacterProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const latestSourceRef = useRef(source);
  latestSourceRef.current = source;
  const [presentation, setPresentation] = useState<ImagePresentation>(() => ({
    source,
    // The mounted DOM image must establish one decoded paint of its own. Even a
    // session-warmed resource can otherwise expose a blank element for one frame.
    ready: false,
  }));

  useEffect(() => {
    if (presentation.source === source) {
      return;
    }

    let cancelled = false;
    let commitFrame: number | undefined;
    const commitSource = () => {
      commitFrame = window.requestAnimationFrame(() => {
        if (cancelled || latestSourceRef.current !== source) {
          return;
        }
        setPresentation({ source, ready: true });
      });
    };

    if (isImageSourceReady(source)) {
      commitSource();
    } else {
      const preload = new Image();
      preload.loading = 'eager';
      preload.fetchPriority = 'high';
      preload.decoding = 'async';
      preload.src = source;
      void waitForImageReady(preload, CHARACTER_IMAGE_READY_TIMEOUT_MS).then((status) => {
        if (!cancelled && status === 'ready') {
          commitSource();
        }
      });
    }

    return () => {
      cancelled = true;
      if (commitFrame !== undefined) {
        window.cancelAnimationFrame(commitFrame);
      }
    };
  }, [presentation.source, source]);

  useEffect(() => {
    if (presentation.ready || latestSourceRef.current !== presentation.source) {
      return;
    }
    const image = imageRef.current;
    if (!image) {
      return;
    }

    let cancelled = false;
    void waitForImageReady(image, CHARACTER_IMAGE_READY_TIMEOUT_MS).then((status) => {
      if (
        cancelled
        || status !== 'ready'
        || latestSourceRef.current !== presentation.source
      ) {
        return;
      }
      setPresentation((current) => (
        current.source === presentation.source && !current.ready
          ? { ...current, ready: true }
          : current
      ));
    });
    return () => {
      cancelled = true;
    };
  }, [presentation.ready, presentation.source]);

  const isHoldingPreviousSource = presentation.source !== source;
  const imageState = isHoldingPreviousSource
    ? 'holding'
    : presentation.ready
      ? 'ready'
      : 'pending';
  const pendingClass = presentation.ready ? '' : 'is-image-pending';

  return (
    <img
      {...imageProps}
      ref={imageRef}
      className={[className, pendingClass].filter(Boolean).join(' ')}
      src={presentation.source}
      data-image-state={imageState}
    />
  );
});
