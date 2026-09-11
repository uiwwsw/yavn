import { memo, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes } from 'react';
import { ResourceImage } from './ResourceImage';
import { waitForImageReady } from './imageReady';
import { finishPortrait, portraitSources, presentPortrait, type PortraitFrame, type PortraitTransition } from './portraitTransition';

type Props = HTMLAttributes<HTMLDivElement> & {
  source: string;
  alt: string;
  fillWidth: boolean;
  fillHeight: boolean;
  onReady: () => void;
};

/** Retain the painted object while decoding and dissolving its next artwork. */
export const StickerArtwork = memo(function StickerArtwork({
  source, alt, fillWidth, fillHeight, onReady, className = '', ...props
}: Props) {
  const images = useRef(new Map<string, HTMLImageElement>());
  const [presentation, setPresentation] = useState<PortraitTransition>({});
  const [prepared, setPrepared] = useState<PortraitFrame>();
  const latest = useRef({ source, onReady });
  latest.current = { source, onReady };

  useEffect(() => {
    let cancelled = false;
    const image = images.current.get(source);
    if (image) void waitForImageReady(image, 12000).then(status => {
      if (!cancelled && status === 'ready' && latest.current.source === source) {
        setPrepared({ source, ratio: image.naturalWidth / Math.max(1, image.naturalHeight) });
      }
    });
    return () => { cancelled = true; };
  }, [source]);

  useEffect(() => {
    if (!prepared || prepared.source !== source) return;
    setPresentation(current => presentPortrait(current, prepared));
  }, [prepared, source, presentation.previous]);

  useLayoutEffect(() => {
    if (presentation.current) latest.current.onReady();
  }, [presentation.current]);

  const finish = (painted: string) => setPresentation(current => finishPortrait(current, painted));
  useEffect(() => {
    if (!presentation.previous || !presentation.current) return;
    const painted = presentation.current.source;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(painted); return; }
    const timer = window.setTimeout(() => finish(painted), 600);
    return () => window.clearTimeout(timer);
  }, [presentation.current, presentation.previous]);

  return (
    <div {...props} className={`${className} sticker-artwork`} role="img" aria-label={alt}
      data-dissolving={Boolean(presentation.previous)}
      data-image-state={!presentation.current ? 'pending' : presentation.current.source !== source ? 'holding' : 'ready'}>
      {portraitSources(presentation, source).map(url => {
        const role = url === presentation.current?.source ? 'current' : url === presentation.previous?.source ? 'previous' : 'pending';
        return <ResourceImage key={url} ref={image => { if (image) images.current.set(url, image); else images.current.delete(url); }}
          src={url} alt="" aria-hidden="true" className={`sticker-art portrait-${role}`} data-portrait-role={role}
          loading="eager" decoding="async" draggable={false}
          style={role === 'current' ? {
            // SVG assets may have only a viewBox. Give their auto-sized grid
            // an intrinsic width so max-width:100% cannot collapse it to zero.
            width: fillWidth ? '100%' : !fillHeight ? images.current.get(url)?.naturalWidth : undefined,
            height: fillHeight ? '100%' : undefined,
          } : undefined}
          onAnimationEnd={event => { if (role === 'current' && event.animationName === 'portraitReveal') finish(url); }} />;
      })}
    </div>
  );
});
