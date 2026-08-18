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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const hasArea = (rect: StickerLayoutRect) =>
  rect.width > 0 && rect.height > 0;

const projectStickerRect = (
  sticker: StickerLayoutRect,
  fit: StickerFit,
): StickerLayoutRect => {
  const centerX = (sticker.left + sticker.right) / 2 + fit.translateX;
  const centerY = (sticker.top + sticker.bottom) / 2 + fit.translateY;
  const width = sticker.width * fit.scale;
  const height = sticker.height * fit.scale;
  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
    width,
    height,
  };
};

const intersectionArea = (a: StickerLayoutRect, b: StickerLayoutRect) => (
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
);

const expandRect = (rect: StickerLayoutRect, gap: number): StickerLayoutRect => ({
  left: rect.left - gap,
  right: rect.right + gap,
  top: rect.top - gap,
  bottom: rect.bottom + gap,
  width: rect.width + gap * 2,
  height: rect.height + gap * 2,
});

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

/**
 * Keeps the authored sticker position whenever possible, but moves it to the
 * nearest open part of the safe frame when a visible character covers it.
 * Scaling is only reduced when no collision-free position exists at the
 * current size.
 */
export function fitStickerWithinFrameAvoidingRects(
  frame: StickerLayoutRect,
  sticker: StickerLayoutRect,
  obstacles: StickerLayoutRect[],
  gap = 12,
): StickerFit {
  const safeFit = fitStickerWithinFrame(frame, sticker);
  if (!hasArea(frame) || !hasArea(sticker)) {
    return safeFit;
  }

  const relevantObstacles = obstacles.filter(
    (obstacle) => hasArea(obstacle) && intersectionArea(frame, obstacle) > 0,
  );
  if (relevantObstacles.length === 0) {
    return safeFit;
  }

  const avoidanceGap = Math.max(0, gap);
  const expandedObstacles = relevantObstacles.map((obstacle) =>
    expandRect(obstacle, avoidanceGap));
  const safeRect = projectStickerRect(sticker, safeFit);
  if (expandedObstacles.every((obstacle) => intersectionArea(safeRect, obstacle) === 0)) {
    return safeFit;
  }

  const authoredCenterX = (sticker.left + sticker.right) / 2;
  const authoredCenterY = (sticker.top + sticker.bottom) / 2;
  const preferredCenterX = (safeRect.left + safeRect.right) / 2;
  const preferredCenterY = (safeRect.top + safeRect.bottom) / 2;
  const scaleFactors = [1, 0.9, 0.8, 0.7];
  let bestFallback:
    | { fit: StickerFit; overlap: number; distance: number; scale: number }
    | undefined;

  for (const scaleFactor of scaleFactors) {
    const scale = safeFit.scale * scaleFactor;
    const width = sticker.width * scale;
    const height = sticker.height * scale;
    const maxLeft = frame.right - width;
    const maxTop = frame.bottom - height;
    const preferredLeft = clamp(preferredCenterX - width / 2, frame.left, maxLeft);
    const preferredTop = clamp(preferredCenterY - height / 2, frame.top, maxTop);
    const leftCandidates = [preferredLeft, frame.left, maxLeft];
    const topCandidates = [preferredTop, frame.top, maxTop];

    for (const obstacle of relevantObstacles) {
      leftCandidates.push(
        obstacle.left - avoidanceGap - width,
        obstacle.right + avoidanceGap,
      );
      topCandidates.push(
        obstacle.top - avoidanceGap - height,
        obstacle.bottom + avoidanceGap,
      );
    }

    const uniqueLefts = [
      ...new Set(leftCandidates.map((left) => clamp(left, frame.left, maxLeft))),
    ];
    const uniqueTops = [
      ...new Set(topCandidates.map((top) => clamp(top, frame.top, maxTop))),
    ];
    let bestAtScale:
      | { fit: StickerFit; overlap: number; distance: number; scale: number }
      | undefined;

    for (const left of uniqueLefts) {
      for (const top of uniqueTops) {
        const candidateRect: StickerLayoutRect = {
          left,
          right: left + width,
          top,
          bottom: top + height,
          width,
          height,
        };
        const overlap = expandedObstacles.reduce(
          (total, obstacle) => total + intersectionArea(candidateRect, obstacle),
          0,
        );
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const distance = (centerX - preferredCenterX) ** 2
          + (centerY - preferredCenterY) ** 2;
        const candidate = {
          fit: {
            scale,
            translateX: centerX - authoredCenterX,
            translateY: centerY - authoredCenterY,
          },
          overlap,
          distance,
          scale,
        };

        if (
          !bestAtScale
          || candidate.overlap < bestAtScale.overlap
          || (candidate.overlap === bestAtScale.overlap && candidate.distance < bestAtScale.distance)
        ) {
          bestAtScale = candidate;
        }
      }
    }

    if (bestAtScale?.overlap === 0) {
      return bestAtScale.fit;
    }
    if (
      bestAtScale
      && (
        !bestFallback
        || bestAtScale.overlap < bestFallback.overlap
        || (bestAtScale.overlap === bestFallback.overlap && bestAtScale.scale > bestFallback.scale)
        || (
          bestAtScale.overlap === bestFallback.overlap
          && bestAtScale.scale === bestFallback.scale
          && bestAtScale.distance < bestFallback.distance
        )
      )
    ) {
      bestFallback = bestAtScale;
    }
  }

  return bestFallback?.fit ?? safeFit;
}
