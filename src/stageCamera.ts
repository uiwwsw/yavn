import type {
  CameraDirective,
  CameraShot,
  CameraTransition,
  CharacterCalibration,
  Position,
  StageCameraState,
} from './types';
import type { CharacterStageLayout } from './characterLayout';
import { resolveCharacterStagePlacement, resolveMobileCameraPan } from './characterLayout';

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

const MEDIUM_SCALE_BY_CAST = [1.72, 1.72, 1.58, 1.38] as const;
const REACTION_SCALE_BY_CAST = [1.9, 1.9, 1.72, 1.55] as const;

export type StageCameraPresentation = {
  scale: number;
  mobileScale: number;
  originY: number;
  mobileOriginY: number;
  panX: string;
  mobilePanX: string;
  panY: string;
  mobilePanY: string;
  duration: number;
  transition: CameraTransition;
};

function resolveMobileShotScale(shot: CameraShot, visibleCharacterCount: number): number {
  const castIndex = Math.max(1, Math.min(3, visibleCharacterCount));
  if (shot === 'medium') {
    return [1, 1.4, 1.58, 1.38][castIndex];
  }
  if (shot === 'close') {
    return [1, 1.67, 2.02, 1.92][castIndex];
  }
  if (shot === 'reaction') {
    return [1, 1.52, 1.83, 1.69][castIndex];
  }
  return 1;
}

function resolveMobileShotOriginY(shot: CameraShot, visibleCharacterCount: number): number {
  if (shot === 'wide') {
    return 50;
  }
  if (visibleCharacterCount <= 1) {
    return shot === 'close' ? 60 : 55;
  }
  return 80;
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

function resolveShotScale(shot: CameraShot, visibleCharacterCount: number): number {
  const castIndex = Math.max(1, Math.min(3, visibleCharacterCount));
  if (shot === 'medium') {
    return MEDIUM_SCALE_BY_CAST[castIndex];
  }
  if (shot === 'close') {
    return 2.15;
  }
  if (shot === 'reaction') {
    return REACTION_SCALE_BY_CAST[castIndex];
  }
  return 1;
}

export function resolveStageCameraPresentation(
  camera: StageCameraState,
  visibleCharacterCount: number,
  targetPosition: Position | undefined,
  layout: CharacterStageLayout,
  targetSpacing = 1,
): StageCameraPresentation {
  const hasCharacterTarget = camera.target !== 'group' && targetPosition !== undefined;
  const panX = hasCharacterTarget
    ? resolveCharacterStagePlacement(targetPosition, layout, targetSpacing).panToCenterX
    : '0px';
  const mobilePanX = hasCharacterTarget
    ? resolveMobileCameraPan(targetPosition, layout)
    : '0px';
  const presentationShot = (camera.shot === 'close' || camera.shot === 'reaction') && !hasCharacterTarget
    ? 'medium'
    : camera.shot;

  return {
    scale: resolveShotScale(presentationShot, visibleCharacterCount),
    mobileScale: resolveMobileShotScale(presentationShot, visibleCharacterCount),
    originY: presentationShot === 'wide' ? 50 : visibleCharacterCount <= 1 ? 0 : 23,
    mobileOriginY: resolveMobileShotOriginY(presentationShot, visibleCharacterCount),
    panX,
    mobilePanX,
    panY: '0px',
    mobilePanY: '0px',
    duration: camera.duration,
    transition: camera.transition,
  };
}
