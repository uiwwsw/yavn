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
  originY: number;
  panX: string;
  mobilePanX: string;
  panY: string;
  mobilePanY: string;
  duration: number;
  transition: CameraTransition;
};

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
  const mobileSoloHeadroom = camera.shot !== 'wide' && visibleCharacterCount <= 1;

  return {
    scale: resolveShotScale(camera.shot, visibleCharacterCount),
    originY: camera.shot === 'wide' ? 50 : visibleCharacterCount <= 1 ? 0 : 23,
    panX,
    mobilePanX,
    panY: '0px',
    mobilePanY: mobileSoloHeadroom ? '4cqh' : '0px',
    duration: camera.duration,
    transition: camera.transition,
  };
}
