import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type AriaAttributes, type CSSProperties, type ImgHTMLAttributes } from 'react';
import { imageResources } from './imageResources';

type Props = Pick<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'className' | 'style' | 'loading' | 'decoding' | 'draggable' | 'onAnimationEnd'> & AriaAttributes & {
  src: string; fetchpriority?: 'high' | 'low' | 'auto';
  onReady?: () => void; onError?: () => void;
};
const previousAttributes = new WeakMap<HTMLImageElement, Set<string>>();
const previousStyles = new WeakMap<HTMLImageElement, string>();

function updateImage(image: HTMLImageElement, props: Props) {
  const attributes = new Set<string>(['data-image-source']);
  if (image.getAttribute('data-image-source') !== props.src) image.setAttribute('data-image-source', props.src);
  for (const [name, value] of Object.entries(props)) {
    if (['src', 'style', 'children'].includes(name) || name.startsWith('on') || value === undefined || value === null) continue;
    const attribute = name === 'className' ? 'class' : name.toLowerCase();
    attributes.add(attribute);
    const text = String(value);
    if (image.getAttribute(attribute) !== text) image.setAttribute(attribute, text);
  }
  for (const previous of previousAttributes.get(image) ?? []) {
    if (!attributes.has(previous)) image.removeAttribute(previous);
  }
  previousAttributes.set(image, attributes);
  const style = props.style ?? {};
  const css = Object.entries(style).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => {
    const property = key.startsWith('--') ? key : key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    const unit = typeof value === 'number' && value !== 0 && !key.startsWith('--') && !['opacity', 'zIndex', 'order', 'flex', 'flexGrow', 'flexShrink', 'fontWeight', 'lineHeight', 'scale'].includes(key) ? 'px' : '';
    return `${property}:${value}${unit}`;
  }).join(';');
  if (previousStyles.get(image) !== css) {
    image.setAttribute('style', css);
    previousStyles.set(image, css);
  }
}

/** React owns the display:contents host; the cache exclusively owns the borrowed <img>. */
export const ResourceImage = forwardRef<HTMLImageElement, Props>(function ResourceImage(props, forwardedRef) {
  const host = useRef<HTMLSpanElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useLayoutEffect(() => {
    const lease = imageResources.acquire(props.src);
    image.current = lease.image;
    updateImage(lease.image, latest.current);
    host.current?.appendChild(lease.image);
    let active = true;
    void lease.ready.then(status => {
      if (active) (status === 'ready' ? latest.current.onReady : latest.current.onError)?.();
    });
    return () => { active = false; image.current = null; lease.release(); };
  }, [props.src]);
  useImperativeHandle(forwardedRef, () => image.current!, [props.src]);
  useLayoutEffect(() => { if (image.current) updateImage(image.current, props); });
  return <span ref={host} className="image-resource-host" style={{ display: 'contents' } as CSSProperties}
    onAnimationEnd={props.onAnimationEnd as ImgHTMLAttributes<HTMLSpanElement>['onAnimationEnd']} />;
});
