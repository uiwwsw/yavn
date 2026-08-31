import type {
  CameraDirective,
  CameraShot,
  CameraTransition,
  CharacterCalibration,
  Position,
  StageCameraState,
} from './types';
import type { CharacterStageLayout } from './characterLayout';
import {
  resolveCharacterCameraPanX,
  resolveMobileCharacterCameraPanX,
} from './characterLayout';

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

export const CHARACTER_EXIT_FADE_DURATION_MS = 180;

// Character count changes horizontal staging only. Keeping one physical camera
// profile prevents a solo, duo, and trio from cropping the same source art at
// different heights when the visible cast changes.
const COMPOSITION_SCALE = 1.62;
const SHOT_SCALE: Record<CameraShot, number> = {
  wide: 1.18,
  medium: COMPOSITION_SCALE,
  close: 2.08,
  reaction: 1.9,
};
// Portrait screens have less room around a fixed character anchor. Keep the
// authored shot hierarchy while softening repeated medium/close cuts so the
// subject does not appear to pulse in size on mobile.
const MOBILE_SHOT_SCALE: Record<CameraShot, number> = {
  wide: 1.12,
  medium: 1.58,
  close: 1.84,
  reaction: 1.72,
};
const COMPOSITION_ORIGIN_Y = 86;
const MOBILE_COMPOSITION_ORIGIN_Y = 82;

export type StageCameraPresentation = {
  shot: CameraShot;
  scale: number;
  mobileScale: number;
  panX: string;
  mobilePanX: string;
  originY: number;
  mobileOriginY: number;
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
  _visibleCharacterCount: number,
): StageCameraTransitionTiming {
  return {
    cameraDelay: 0,
    cameraDuration: presentation.duration,
    characterExitDuration: 0,
  };
}

function resolveShotScale(shot: CameraShot, visibleCharacterCount: number): number {
  if (visibleCharacterCount <= 0) return 1;
  return SHOT_SCALE[shot];
}

function resolveMobileShotScale(shot: CameraShot, visibleCharacterCount: number): number {
  if (visibleCharacterCount <= 0) return 1;
  return MOBILE_SHOT_SCALE[shot];
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
  const transition = directive.transition ?? (
    directive.shot === 'close'
      && directive.target !== undefined
      && directive.target !== 'group'
      ? 'pan'
      : DEFAULT_TRANSITION_BY_SHOT[directive.shot]
  );
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
  const originY = COMPOSITION_ORIGIN_Y;
  // A shorthand close is a stable group push: it changes only scale even though
  // the current speaker remains the focus target. Horizontal targeting is reserved
  // for an explicit pan (or an immediate cut), so alternating dialogue cannot snap
  // the whole cast left and right on every line.
  const shouldApplyHorizontalTarget = hasCharacterTarget && camera.transition !== 'push';
  const panX = shouldApplyHorizontalTarget && targetPosition
    ? resolveCharacterCameraPanX(targetPosition, layout, compositionSpacing)
    : '0cqw';
  const mobilePanX = shouldApplyHorizontalTarget && targetPosition
    ? resolveMobileCharacterCameraPanX(targetPosition, layout)
    : '0cqw';

  return {
    shot: presentationShot,
    scale: resolveShotScale(presentationShot, visibleCharacterCount),
    mobileScale: resolveMobileShotScale(presentationShot, visibleCharacterCount),
    panX,
    mobilePanX,
    originY,
    mobileOriginY: MOBILE_COMPOSITION_ORIGIN_Y,
    duration: camera.duration,
    transition: camera.transition,
  };
}
