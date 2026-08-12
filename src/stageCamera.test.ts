import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAGE_CAMERA,
  resolveCharacterCalibration,
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
      scale: 1.38,
      panX: '0px',
      mobilePanX: '0px',
      originY: 23,
      mobileOriginY: 92,
    });

    const close = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: '칠숙' }),
      3,
      'right',
      trioLayout,
      1.1,
    );
    expect(close).toMatchObject({
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
      originY: 0,
      mobileOriginY: 55,
      panY: '0px',
      mobilePanY: '0px',
    });
    expect(medium).toMatchObject({
      scale: 1.72,
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
    expect(duoMedium).toMatchObject({ scale: 1.58, mobileOriginY: 80, mobilePanY: '0px' });
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
