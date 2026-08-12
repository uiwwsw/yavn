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

  it('builds a fixed medium composition and zooms around a target without panning it', () => {
    const medium = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'medium' }),
      3,
      undefined,
      trioLayout,
    );
    expect(medium).toMatchObject({
      shot: 'medium',
      compositionScale: 1.38,
      mobileCompositionScale: 1.38,
      zoomScale: 1,
      mobileZoomScale: 1,
      zoomOriginX: '50cqw',
      mobileZoomOriginX: '50cqw',
      compositionOriginY: 80,
      mobileCompositionOriginY: 80,
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
      compositionScale: 1.38,
      zoomOriginX: 'calc(50cqw + min(27.5cqw, 352px))',
      mobileZoomOriginX: '75cqw',
      zoomOriginY: 50,
    });
    expect(close.zoomScale).toBeCloseTo(1.92 / 1.38);
    expect(close.mobileZoomScale).toBeCloseTo(1.92 / 1.38);
  });

  it('uses the same portrait composition proportions on mobile and desktop', () => {
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
      compositionScale: 1.4,
      mobileCompositionScale: 1.4,
      compositionOriginY: 55,
      mobileCompositionOriginY: 55,
      zoomOriginX: '50cqw',
      mobileZoomOriginX: '50cqw',
      zoomOriginY: 50,
    });
    expect(close.zoomScale).toBeCloseTo(1.67 / 1.4);
    expect(close.mobileZoomScale).toBeCloseTo(1.67 / 1.4);
    expect(medium).toMatchObject({
      compositionScale: 1.4,
      mobileCompositionScale: 1.4,
      zoomScale: 1,
      mobileZoomScale: 1,
      compositionOriginY: 55,
      mobileCompositionOriginY: 55,
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
      compositionScale: 1.58,
      mobileCompositionScale: 1.58,
      zoomScale: 1,
      mobileZoomScale: 1,
      compositionOriginY: 80,
      mobileCompositionOriginY: 80,
    });

    const duoClose = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: '칠숙' }),
      2,
      'center',
      duoLayout,
    );
    expect(duoClose).toMatchObject({
      compositionScale: 1.58,
      zoomOriginX: 'calc(50cqw - min(25cqw, 320px))',
      mobileZoomOriginX: '25cqw',
    });
    expect(duoClose.zoomScale).toBeCloseTo(2.02 / 1.58);
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
      compositionScale: 1.38,
      zoomScale: 1,
      mobileZoomScale: 1,
      mobileCompositionOriginY: 80,
    });
    expect(untargetedReaction).toMatchObject({
      shot: 'medium',
      compositionScale: 1.4,
      zoomScale: 1,
      mobileZoomScale: 1,
      mobileCompositionOriginY: 55,
    });
  });

  it('keeps a sole actor centered while wide only changes zoom level', () => {
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
    );
    const wide = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'wide' }),
      1,
      undefined,
      soloLayout,
      1,
    );

    expect(medium).toMatchObject({
      zoomScale: 1,
      zoomOriginX: '50cqw',
      mobileZoomOriginX: '50cqw',
    });
    expect(wide.zoomScale).toBeCloseTo(1 / 1.4);
    expect(wide.mobileZoomScale).toBeCloseTo(1 / 1.4);
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
