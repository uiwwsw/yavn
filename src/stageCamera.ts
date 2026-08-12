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

const COMPOSITION_SCALE_BY_CAST = [1, 1.4, 1.58, 1.38] as const;
const CLOSE_SCALE_BY_CAST = [1, 1.67, 2.02, 1.92] as const;
const REACTION_SCALE_BY_CAST = [1, 1.52, 1.83, 1.69] as const;

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

function resolveCompositionScale(visibleCharacterCount: number): number {
  if (visibleCharacterCount <= 0) return 1;
  const castIndex = Math.max(1, Math.min(3, visibleCharacterCount));
  return COMPOSITION_SCALE_BY_CAST[castIndex];
}

function resolveShotScale(shot: CameraShot, visibleCharacterCount: number): number {
  if (visibleCharacterCount <= 0) return 1;
  const castIndex = Math.max(1, Math.min(3, visibleCharacterCount));
  if (shot === 'medium') return COMPOSITION_SCALE_BY_CAST[castIndex];
  if (shot === 'close') {
    return CLOSE_SCALE_BY_CAST[castIndex];
  }
  if (shot === 'reaction') {
    return REACTION_SCALE_BY_CAST[castIndex];
  }
  return 1;
}

function resolveCompositionOriginY(visibleCharacterCount: number): number {
  return visibleCharacterCount <= 1 ? 55 : 80;
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
  const compositionOriginY = resolveCompositionOriginY(visibleCharacterCount);
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
    mobileZoomScale: shotScale / compositionScale,
    zoomOriginX,
    mobileZoomOriginX,
    zoomOriginY,
    mobileZoomOriginY: zoomOriginY,
    duration: camera.duration,
    transition: camera.transition,
  };
}
