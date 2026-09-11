import type { StickerSlot } from './types';

/** Measure CSS percentages/clamps without touching the painted, animating box. */
export function measureStickerBox(
  frame: HTMLElement,
  sticker: StickerSlot,
  image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>,
  transform: string,
) {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
    display: 'grid', placeItems: 'center', maxInlineSize: '100%', maxWidth: '100cqw',
    left: sticker.x, top: sticker.y, width: sticker.width ?? '', height: sticker.height ?? '', transform,
  });
  const artwork = document.createElement('div');
  artwork.className = 'sticker-visual';
  const fillWidth = Boolean(sticker.width && sticker.width !== 'auto');
  const fillHeight = Boolean(sticker.height && sticker.height !== 'auto');
  artwork.style.width = fillWidth ? '100%' : '';
  artwork.style.height = fillHeight ? '100%' : '';
  // An empty SVG has the decoded image's intrinsic box, without cloning an
  // image, requesting a resource, or borrowing another decoded frame.
  const intrinsic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  intrinsic.setAttribute('width', String(image.naturalWidth));
  intrinsic.setAttribute('height', String(image.naturalHeight));
  intrinsic.setAttribute('viewBox', `0 0 ${image.naturalWidth} ${image.naturalHeight}`);
  Object.assign(intrinsic.style, {
    display: 'block', maxWidth: '100%',
    width: fillWidth ? '100%' : 'auto', height: fillHeight ? '100%' : 'auto',
  });
  artwork.append(intrinsic);
  probe.append(artwork);
  frame.append(probe);
  try {
    return {
      rect: probe.getBoundingClientRect(),
      box: { left: probe.offsetLeft, top: probe.offsetTop, width: probe.offsetWidth, height: probe.offsetHeight },
    };
  } finally {
    probe.remove();
  }
}
