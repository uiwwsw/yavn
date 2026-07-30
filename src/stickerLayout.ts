export type StickerLayoutRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type StickerFit = {
  scale: number;
  translateX: number;
  translateY: number;
};

export function fitStickerWithinFrame(
  frame: StickerLayoutRect,
  sticker: StickerLayoutRect,
): StickerFit {
  if (
    frame.width <= 0 ||
    frame.height <= 0 ||
    sticker.width <= 0 ||
    sticker.height <= 0
  ) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }

  const scale = Math.min(
    1,
    frame.width / sticker.width,
    frame.height / sticker.height,
  );
  const centerX = (sticker.left + sticker.right) / 2;
  const centerY = (sticker.top + sticker.bottom) / 2;
  const fittedWidth = sticker.width * scale;
  const fittedHeight = sticker.height * scale;
  const fittedLeft = centerX - fittedWidth / 2;
  const fittedRight = centerX + fittedWidth / 2;
  const fittedTop = centerY - fittedHeight / 2;
  const fittedBottom = centerY + fittedHeight / 2;

  let translateX = 0;
  let translateY = 0;
  if (fittedLeft < frame.left) {
    translateX = frame.left - fittedLeft;
  } else if (fittedRight > frame.right) {
    translateX = frame.right - fittedRight;
  }
  if (fittedTop < frame.top) {
    translateY = frame.top - fittedTop;
  } else if (fittedBottom > frame.bottom) {
    translateY = frame.bottom - fittedBottom;
  }

  return { scale, translateX, translateY };
}
