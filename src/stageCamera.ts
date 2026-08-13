import type {
  CameraDirective,
  CameraShot,
  CameraTransition,
  CharacterCalibration,
  Position,
  StageCameraState,
} from './types';
import type { CharacterStageLayout } from './characterLayout';
import { resolveCharacterStagePlacement, resolveMobileCharacterStageAnchor } from './characterLayout';

export const DEFAULT_STAGE_CAMERA: StageCameraState = {
  shot: 'wide',
  target: 'group',
  transition: 'cut',
  duration: 0,
};

const DEFAULT_TRANSITION_BY_SHOT: Record<CameraShot, CameraTransition> = {
  wide: 'cut',
  medium: 'push',
  close: 'push',
  reaction: 'pan',
};

const DEFAULT_DURATION_BY_TRANSITION: Record<CameraTransition, number> = {
  cut: 0,
  push: 520,
  pan: 380,
};

export const CHARACTER_EXIT_FADE_DURATION_MS = 160;

// Character count changes horizontal staging only. Keeping one physical camera
// profile prevents a solo, duo, and trio from cropping the same source art at
// different heights when the visible cast changes.
const COMPOSITION_SCALE = 1.58;
const SHOT_SCALE: Record<CameraShot, number> = {
  wide: 1,
  medium: COMPOSITION_SCALE,
  close: 2.02,
  reaction: 1.83,
};
// Portrait screens have less room around a fixed character anchor. Keep the
// authored shot hierarchy while softening repeated medium/close cuts so the
// subject does not appear to pulse in size on mobile.
const MOBILE_SHOT_SCALE: Record<CameraShot, number> = {
  wide: 1,
  medium: COMPOSITION_SCALE,
  close: 1.84,
  reaction: 1.72,
};
const COMPOSITION_ORIGIN_Y = 80;

export type StageCameraPresentation = {
  shot: CameraShot;
  compositionScale: number;
  mobileCompositionScale: number;
  compositionOriginY: number;
  mobileCompositionOriginY: number;
  zoomScale: number;
  mobileZoomScale: number;
  zoomOriginX: string;
  mobileZoomOriginX: string;
  zoomOriginY: number;
  mobileZoomOriginY: number;
  duration: number;
  transition: CameraTransition;
};

export type StageCameraTransitionTiming = {
  cameraDelay: number;
  cameraDuration: number;
  characterExitDuration: number;
};

export function resolveStageCameraTransitionTiming(
  presentation: Pick<StageCameraPresentation, 'shot' | 'duration' | 'transition'>,
  visibleCharacterCount: number,
): StageCameraTransitionTiming {
  const hasListenerExit = presentation.shot === 'close'
    && visibleCharacterCount > 1
    && presentation.transition !== 'cut'
    && presentation.duration > 0;
  const characterExitDuration = hasListenerExit
    ? Math.min(CHARACTER_EXIT_FADE_DURATION_MS, Math.floor(presentation.duration / 2))
    : 0;

  return {
    cameraDelay: characterExitDuration,
    cameraDuration: Math.max(0, presentation.duration - characterExitDuration),
    characterExitDuration,
  };
}

function resolveCompositionScale(visibleCharacterCount: number): number {
  return visibleCharacterCount > 0 ? COMPOSITION_SCALE : 1;
}

function resolveShotScale(shot: CameraShot, visibleCharacterCount: number): number {
  if (visibleCharacterCount <= 0) return 1;
  return SHOT_SCALE[shot];
}

function resolveMobileShotScale(shot: CameraShot, visibleCharacterCount: number): number {
  if (visibleCharacterCount <= 0) return 1;
  return MOBILE_SHOT_SCALE[shot];
}

function resolveCompositionOriginY(): number {
  return COMPOSITION_ORIGIN_Y;
}

export function resolveCharacterCalibration(
  calibration: CharacterCalibration | undefined,
): Required<CharacterCalibration> {
  return {
    scale: calibration?.scale ?? 1,
    x: calibration?.x ?? 0,
    y: calibration?.y ?? 0,
    spacing: calibration?.spacing ?? 1,
  };
}

export function resolveStageCameraFocusTargetId(
  camera: StageCameraState,
  visibleCharacterIds: readonly string[],
  speakerId?: string,
  directedTargetId?: string,
): string | undefined {
  const requestedTargetId = camera.target === 'group' ? undefined : camera.target;
  const currentDialogTargetId = directedTargetId
    ?? ((camera.shot === 'close' || camera.shot === 'reaction') ? speakerId : undefined);

  if (
    !currentDialogTargetId
    || requestedTargetId !== currentDialogTargetId
    || !visibleCharacterIds.includes(currentDialogTargetId)
  ) {
    return undefined;
  }
  return currentDialogTargetId;
}

export function resolveStageCameraState(
  directive: CameraDirective,
  speakerId?: string,
): StageCameraState {
  const transition = directive.transition ?? DEFAULT_TRANSITION_BY_SHOT[directive.shot];
  const defaultTarget = directive.shot === 'close' || directive.shot === 'reaction'
    ? (speakerId ?? 'group')
    : 'group';
  const requestedTarget = directive.target ?? defaultTarget;
  const target = requestedTarget === 'speaker' ? (speakerId ?? 'group') : requestedTarget;
  const duration = transition === 'cut'
    ? 0
    : (directive.duration ?? DEFAULT_DURATION_BY_TRANSITION[transition]);

  return {
    shot: directive.shot,
    target,
    transition,
    duration,
  };
}

export function resolveStageCameraPresentation(
  camera: StageCameraState,
  visibleCharacterCount: number,
  targetPosition: Position | undefined,
  layout: CharacterStageLayout,
  compositionSpacing = 1,
): StageCameraPresentation {
  const hasCharacterTarget = camera.target !== 'group' && targetPosition !== undefined;
  const presentationShot = (camera.shot === 'close' || camera.shot === 'reaction') && !hasCharacterTarget
    ? 'medium'
    : camera.shot;
  const compositionScale = resolveCompositionScale(visibleCharacterCount);
  const shotScale = resolveShotScale(presentationShot, visibleCharacterCount);
  const mobileShotScale = resolveMobileShotScale(presentationShot, visibleCharacterCount);
  const compositionOriginY = resolveCompositionOriginY();
  const zoomOriginX = hasCharacterTarget && targetPosition
    ? resolveCharacterStagePlacement(targetPosition, layout, compositionSpacing).anchorX
    : '50cqw';
  const mobileZoomOriginX = hasCharacterTarget && targetPosition
    ? resolveMobileCharacterStageAnchor(targetPosition, layout)
    : '50cqw';
  const zoomOriginY = presentationShot === 'wide' ? compositionOriginY : 50;

  return {
    shot: presentationShot,
    compositionScale,
    mobileCompositionScale: compositionScale,
    compositionOriginY,
    mobileCompositionOriginY: compositionOriginY,
    zoomScale: shotScale / compositionScale,
    mobileZoomScale: mobileShotScale / compositionScale,
    zoomOriginX,
    mobileZoomOriginX,
    zoomOriginY,
    mobileZoomOriginY: zoomOriginY,
    duration: camera.duration,
    transition: camera.transition,
  };
}
