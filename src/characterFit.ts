/**
 * How wide a half-body actor is actually drawn.
 *
 * The portrait is an absolutely positioned image at `height: 100%` of its wrapper with
 * `width: auto`, so its width comes from the source ratio; the crop transform that frames the
 * upper body then zooms it by `1 / visibleFraction`. Capping the wrapper does nothing, because
 * the image carries `max-width: none` and overflows it.
 */
export function drawnActorWidth({
  height,
  sourceRatio,
  visibleFraction,
  cameraScale = 1,
}: {
  height: number;
  sourceRatio: number;
  visibleFraction: number;
  cameraScale?: number;
}): number {
  return (height * sourceRatio * cameraScale) / visibleFraction;
}

/**
 * The slice of screen an actor may fill: twice the distance from its anchor to the nearest
 * edge, so a pair divides the screen between them and a centred solo actor keeps all of it.
 */
export function actorSlotWidth({
  anchorX,
  stageWidth,
  castSize = 1,
}: {
  anchorX: number;
  stageWidth: number;
  /** How many actors share the stage; the centre of a trio must not be handed all of it. */
  castSize?: number;
}): number {
  return Math.min(2 * Math.min(anchorX, stageWidth - anchorX), stageWidth / castSize);
}

/**
 * Height for an actor that must fit its slot. Inverting {@link drawnActorWidth} gives the
 * height whose drawn width is exactly the slot, and the stage height still wins when it is
 * the smaller of the two.
 */
export function resolveActorHeight({
  stageHeight,
  anchorX,
  stageWidth,
  sourceRatio,
  visibleFraction,
  cameraScale = 1,
  castSize = 1,
}: {
  stageHeight: number;
  anchorX: number;
  stageWidth: number;
  sourceRatio: number;
  visibleFraction: number;
  /** The shot's zoom. Actors are laid out in stage space and the camera scales the result. */
  cameraScale?: number;
  castSize?: number;
}): number {
  const slot = actorSlotWidth({ anchorX, stageWidth, castSize });
  return Math.min(stageHeight, (slot * visibleFraction) / sourceRatio / cameraScale);
}
