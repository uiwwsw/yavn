import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAGE_CAMERA,
  resolveCharacterCalibration,
  resolveStageCameraFocusTargetId,
  resolveStageCameraPresentation,
  resolveStageCameraState,
} from './stageCamera';
import type { CharacterStageLayout } from './characterLayout';

const trioLayout: CharacterStageLayout = {
  mode: 'trio',
  duoSideByPosition: {},
  characterIdByPosition: { left: '아진', center: '덕만', right: '칠숙' },
};

describe('stage camera', () => {
  it('starts as a stable group-wide shot', () => {
    expect(DEFAULT_STAGE_CAMERA).toEqual({
      shot: 'wide',
      target: 'group',
      transition: 'cut',
      duration: 0,
    });
  });

  it('normalizes shorthand defaults around the group or current speaker', () => {
    expect(resolveStageCameraState({ shot: 'medium' }, '덕만')).toEqual({
      shot: 'medium',
      target: 'group',
      transition: 'push',
      duration: 520,
    });
    expect(resolveStageCameraState({ shot: 'close' }, '덕만')).toEqual({
      shot: 'close',
      target: '덕만',
      transition: 'push',
      duration: 520,
    });
    expect(resolveStageCameraState({ shot: 'reaction', target: 'speaker' }, '칠숙')).toMatchObject({
      target: '칠숙',
      transition: 'pan',
      duration: 380,
    });
  });

  it('zooms the shared world and centers a targeted trio character', () => {
    const medium = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'medium' }),
      3,
      undefined,
      trioLayout,
    );
    expect(medium).toMatchObject({
      shot: 'medium',
      scale: 1.38,
      mobileScale: 1.38,
      panX: '0px',
      mobilePanX: '0px',
      originY: 23,
      mobileOriginY: 80,
    });

    const close = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: '칠숙' }),
      3,
      'right',
      trioLayout,
      1.1,
    );
    expect(close).toMatchObject({
      shot: 'close',
      scale: 2.15,
      panX: 'calc(0px - min(19.8cqw, 286px))',
      mobilePanX: '-35cqw',
    });
  });

  it('zooms portrait-mobile shots from a cast-aware lower anchor so actors rise above dialogue', () => {
    const soloLayout: CharacterStageLayout = {
      mode: 'default',
      duoSideByPosition: {},
      characterIdByPosition: { center: '덕만' },
    };
    const close = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close' }, '덕만'),
      1,
      'center',
      soloLayout,
    );
    const medium = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'medium' }),
      1,
      undefined,
      soloLayout,
    );

    expect(close).toMatchObject({
      scale: 2.15,
      mobileScale: 1.67,
      originY: 0,
      mobileOriginY: 60,
      panY: '0px',
      mobilePanY: '0px',
    });
    expect(medium).toMatchObject({
      scale: 1.72,
      mobileScale: 1.4,
      originY: 0,
      mobileOriginY: 55,
      panY: '0px',
      mobilePanY: '0px',
    });

    const duoLayout: CharacterStageLayout = {
      mode: 'duo',
      duoSideByPosition: { center: 'left', right: 'right' },
      characterIdByPosition: { center: '칠숙', right: '진평왕' },
    };
    const duoMedium = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'medium' }),
      2,
      undefined,
      duoLayout,
    );
    expect(duoMedium).toMatchObject({
      scale: 1.58,
      mobileScale: 1.58,
      mobileOriginY: 80,
      mobilePanY: '0px',
    });

    const duoClose = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: '칠숙' }),
      2,
      'center',
      duoLayout,
    );
    expect(duoClose).toMatchObject({ scale: 2.15, mobileScale: 2.02, mobileOriginY: 80 });
  });

  it('falls back to a medium group composition when a close or reaction shot has no target', () => {
    const untargetedClose = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: 'group' }),
      3,
      undefined,
      trioLayout,
    );
    const untargetedReaction = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'reaction', target: 'group' }),
      1,
      undefined,
      {
        mode: 'default',
        duoSideByPosition: {},
        characterIdByPosition: { center: '덕만' },
      },
    );

    expect(untargetedClose).toMatchObject({
      shot: 'medium',
      scale: 1.38,
      mobileScale: 1.38,
      mobileOriginY: 80,
    });
    expect(untargetedReaction).toMatchObject({
      shot: 'medium',
      scale: 1.72,
      mobileScale: 1.4,
      mobileOriginY: 55,
    });
  });

  it('centers a sole actor for medium shots without changing the authored wide position', () => {
    const soloLayout: CharacterStageLayout = {
      mode: 'default',
      duoSideByPosition: {},
      characterIdByPosition: { left: '덕만' },
    };
    const medium = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'medium' }),
      1,
      undefined,
      soloLayout,
      1,
      'left',
    );
    const wide = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'wide' }),
      1,
      undefined,
      soloLayout,
      1,
      'left',
    );

    expect(medium).toMatchObject({ panX: '25cqw', mobilePanX: '25cqw' });
    expect(wide).toMatchObject({ panX: '0px', mobilePanX: '0px' });
  });

  it('does not carry a previous speaker focus into an untargeted narration line', () => {
    const closeOnDeokman = resolveStageCameraState({ shot: 'close' }, '덕만');

    expect(resolveStageCameraFocusTargetId(closeOnDeokman, ['덕만'], undefined)).toBeUndefined();
    expect(resolveStageCameraFocusTargetId(closeOnDeokman, ['덕만'], '덕만')).toBe('덕만');
    expect(resolveStageCameraFocusTargetId(closeOnDeokman, ['덕만'], undefined, '덕만')).toBe('덕만');
    expect(resolveStageCameraFocusTargetId(closeOnDeokman, ['덕만', '칠숙'], '칠숙')).toBeUndefined();
  });

  it('keeps asset calibration separate from camera shot scale', () => {
    expect(resolveCharacterCalibration(undefined)).toEqual({ scale: 1, x: 0, y: 0, spacing: 1 });
    expect(resolveCharacterCalibration({ scale: 1.08, y: -3, spacing: 0.92 })).toEqual({
      scale: 1.08,
      x: 0,
      y: -3,
      spacing: 0.92,
    });
  });
});
