import { memo, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { waitForImageReady } from './imageReady';
import { CharacterPresence } from './CharacterPresence';
import { ResourceImage } from './ResourceImage';
import { PORTRAIT_DISSOLVE_MS, finishPortrait, portraitSources, presentPortrait, type PortraitFrame, type PortraitTransition } from './portraitTransition';
import type { CharacterEnterEffect } from './types';

const CHARACTER_IMAGE_READY_TIMEOUT_MS = 12000;
type Props = HTMLAttributes<HTMLDivElement> & {
  source: string; alt: string; visible: boolean; enterEffect: CharacterEnterEffect;
  cropBottom?: number;
  fetchpriority?: 'high' | 'low' | 'auto'; loading?: 'eager' | 'lazy'; decoding?: 'async' | 'sync' | 'auto';
};

/** Decoded DOM frames, one active dissolve and one latest request. No source-swap flash. */
export const StageImageCharacter = memo(function StageImageCharacter({
  source, alt, visible, enterEffect, cropBottom = 0, className = '', style, fetchpriority, loading, decoding, ...props
}: Props) {
  const images = useRef(new Map<string, HTMLImageElement>());
  const [presentation, setPresentation] = useState<PortraitTransition>({});
  const [prepared, setPrepared] = useState<PortraitFrame>();
  const frameRatio = useRef<number>();
  if (presentation.current && frameRatio.current === undefined) frameRatio.current = presentation.current.ratio;
  const latestSourceRef = useRef(source);
  latestSourceRef.current = source;

  useEffect(() => {
    let cancelled = false;
    const image = images.current.get(source);
    if (image) void waitForImageReady(image, CHARACTER_IMAGE_READY_TIMEOUT_MS).then((status) => {
      if (!cancelled && status === 'ready' && latestSourceRef.current === source) {
        setPrepared({ source, ratio: image.naturalWidth / Math.max(1, image.naturalHeight) });
      }
    });
    return () => { cancelled = true; };
  }, [source]);

  useEffect(() => {
    if (!prepared || prepared.source !== source) return;
    setPresentation((current) => presentPortrait(current, prepared));
  }, [prepared, source, presentation.previous]);

  const finish = (painted: string) => setPresentation(current => finishPortrait(current, painted));
  useEffect(() => {
    if (!presentation.previous || !presentation.current) return;
    // animationend is authoritative; the watchdog only handles detached/reduced-motion layers.
    const painted = presentation.current.source;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { finish(painted); return; }
    const timer = window.setTimeout(() => finish(painted), 600);
    return () => window.clearTimeout(timer);
  }, [presentation.current, presentation.previous]);

  return (
    <div {...props} className={`${className} character-actor`} style={{ ...style,
      '--character-source-ratio': frameRatio.current ?? 1,
      '--character-visible-fraction': 1 - cropBottom,
      '--portrait-dissolve-duration': `${PORTRAIT_DISSOLVE_MS}ms`,
    } as CSSProperties} role="img" aria-label={alt}
      data-image-state={!presentation.current ? 'pending' : presentation.current.source !== source ? 'holding' : 'ready'}>
      <CharacterPresence visible={visible} ready={Boolean(presentation.current)} effect={enterEffect}>
        <div className="character-portrait" data-dissolving={Boolean(presentation.previous)} data-cropped={cropBottom > 0}>
          {portraitSources(presentation, source).map((url) => {
            const role = url === presentation.current?.source ? 'current' : url === presentation.previous?.source ? 'previous' : 'pending';
            return <ResourceImage key={url} ref={element => { if (element) images.current.set(url, element); else images.current.delete(url); }}
              src={url} alt="" aria-hidden="true" className={`character-art portrait-${role}`}
              data-character-requested={url === source} data-portrait-role={role}
              loading={loading} decoding={decoding} {...{ fetchpriority }} draggable={false}
              onAnimationEnd={(event) => { if (role === 'current' && event.animationName === 'portraitReveal') finish(url); }} />;
          })}
        </div>
      </CharacterPresence>
    </div>
  );
});
