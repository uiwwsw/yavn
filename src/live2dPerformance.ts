export const LIVE2D_MAX_DEVICE_PIXEL_RATIO = 2;
export const LIVE2D_RESIZE_QUIET_MS = 80;

export function resolveLive2DCanvasPixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio)) {
    return 1;
  }
  return Math.min(LIVE2D_MAX_DEVICE_PIXEL_RATIO, Math.max(1, devicePixelRatio));
}

export function shouldRunLive2DTicker(
  modelReady: boolean,
  active: boolean,
  documentVisible: boolean,
): boolean {
  // easy-cl2d advances model loading from its ticker, so an inactive actor must
  // finish warming before its renderer can be parked safely.
  return !modelReady || (active && documentVisible);
}
