import { describe, expect, it } from 'vitest';
import {
  CHARACTER_EXIT_FADE_DURATION_MS,
  DEFAULT_STAGE_CAMERA,
  resolveCharacterCalibration,
  resolveStageCameraFocusTargetId,
  resolveStageCameraPresentation,
  resolveStageCameraState,
  resolveStageCameraTransitionTiming,
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

  it('uses one absolute scale and pans a directed target to the centre', () => {
    const medium = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'medium' }),
      3,
      undefined,
      trioLayout,
    );
    expect(medium).toMatchObject({
      shot: 'medium',
      scale: 1.62,
      mobileScale: 1.58,
      panX: '0cqw',
      mobilePanX: '0cqw',
      originY: 86,
      mobileOriginY: 82,
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
      scale: 2.08,
      mobileScale: 1.84,
      panX: 'calc(0px - min(27.5cqw, 286px))',
      mobilePanX: '-25cqw',
      originY: 86,
    });
  });

  it('uses one portrait and crop ratio for solo, duo, and trio on mobile and desktop', () => {
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
      scale: 2.08,
      mobileScale: 1.84,
      panX: '0cqw',
      mobilePanX: '0cqw',
      originY: 86,
      mobileOriginY: 82,
    });
    expect(medium).toMatchObject({
      scale: 1.62,
      mobileScale: 1.58,
      panX: '0cqw',
      mobilePanX: '0cqw',
      originY: 86,
      mobileOriginY: 82,
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
      scale: 1.62,
      mobileScale: 1.58,
      panX: '0cqw',
      mobilePanX: '0cqw',
      originY: 86,
      mobileOriginY: 82,
    });

    const duoClose = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: '칠숙' }),
      2,
      'center',
      duoLayout,
    );
    expect(duoClose).toMatchObject({
      scale: 2.08,
      mobileScale: 1.84,
      panX: 'min(25cqw, 260px)',
      mobilePanX: '25cqw',
    });

    expect(medium.scale).toBe(duoMedium.scale);
    expect(medium.scale).toBe(
      resolveStageCameraPresentation(
        resolveStageCameraState({ shot: 'medium' }),
        3,
        undefined,
        trioLayout,
      ).scale,
    );
  });

  it('keeps every camera shot on one absolute scale profile for every cast size', () => {
    const soloLayout: CharacterStageLayout = {
      mode: 'default',
      duoSideByPosition: {},
      characterIdByPosition: { center: '덕만' },
    };
    const duoLayout: CharacterStageLayout = {
      mode: 'duo',
      duoSideByPosition: { left: 'left', right: 'right' },
      characterIdByPosition: { left: '아진', right: '칠숙' },
    };
    const cases = [
      { count: 1, layout: soloLayout, position: 'center' as const, target: '덕만' },
      { count: 2, layout: duoLayout, position: 'left' as const, target: '아진' },
      { count: 3, layout: trioLayout, position: 'left' as const, target: '아진' },
    ];

    for (const { count, layout, position, target } of cases) {
      const medium = resolveStageCameraPresentation(
        resolveStageCameraState({ shot: 'medium' }),
        count,
        undefined,
        layout,
      );
      const wide = resolveStageCameraPresentation(
        resolveStageCameraState({ shot: 'wide' }),
        count,
        undefined,
        layout,
      );
      const close = resolveStageCameraPresentation(
        resolveStageCameraState({ shot: 'close', target }),
        count,
        position,
        layout,
      );
      const reaction = resolveStageCameraPresentation(
        resolveStageCameraState({ shot: 'reaction', target }),
        count,
        position,
        layout,
      );

      expect(medium.scale).toBe(1.62);
      expect(medium.originY).toBe(86);
      expect(medium.mobileOriginY).toBe(82);
      expect(wide.scale).toBeCloseTo(1.18);
      expect(close.scale).toBeCloseTo(2.08);
      expect(reaction.scale).toBeCloseTo(1.9);
      expect(wide.mobileScale).toBeCloseTo(1.12);
      expect(medium.mobileScale).toBeCloseTo(1.58);
      expect(close.mobileScale).toBeCloseTo(1.84);
      expect(reaction.mobileScale).toBeCloseTo(1.72);
    }
  });

  it('softens mobile close cuts without changing the desktop camera profile', () => {
    const close = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: '덕만' }),
      1,
      'center',
      {
        mode: 'default',
        duoSideByPosition: {},
        characterIdByPosition: { center: '덕만' },
      },
    );

    expect(close.scale).toBeCloseTo(2.08);
    expect(close.mobileScale).toBeCloseTo(1.84);
    expect(close.mobileScale).toBeLessThan(close.scale);
    expect(1.84 / 1.58).toBeLessThan(1.2);
  });

  it('finishes a multi-actor close exit before the camera moves', () => {
    expect(CHARACTER_EXIT_FADE_DURATION_MS).toBe(180);
    const close = resolveStageCameraPresentation(
      resolveStageCameraState({ shot: 'close', target: '덕만' }),
      2,
      'center',
      {
        mode: 'duo',
        duoSideByPosition: { center: 'left', right: 'right' },
        characterIdByPosition: { center: '덕만', right: '칠숙' },
      },
    );

    expect(resolveStageCameraTransitionTiming(close, 2)).toEqual({
      cameraDelay: CHARACTER_EXIT_FADE_DURATION_MS,
      cameraDuration: 340,
      characterExitDuration: CHARACTER_EXIT_FADE_DURATION_MS,
    });
    expect(resolveStageCameraTransitionTiming(close, 1)).toEqual({
      cameraDelay: 0,
      cameraDuration: 520,
      characterExitDuration: 0,
    });
    expect(resolveStageCameraTransitionTiming({ ...close, duration: 200 }, 2)).toEqual({
      cameraDelay: 100,
      cameraDuration: 100,
      characterExitDuration: 100,
    });
    expect(resolveStageCameraTransitionTiming({ ...close, transition: 'cut', duration: 0 }, 2)).toEqual({
      cameraDelay: 0,
      cameraDuration: 0,
      characterExitDuration: 0,
    });
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
      scale: 1.62,
      mobileScale: 1.58,
      panX: '0cqw',
      mobileOriginY: 82,
    });
    expect(untargetedReaction).toMatchObject({
      shot: 'medium',
      scale: 1.62,
      mobileScale: 1.58,
      panX: '0cqw',
      mobileOriginY: 82,
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
      scale: 1.62,
      panX: '0cqw',
      mobilePanX: '0cqw',
    });
    expect(wide.scale).toBeCloseTo(1.18);
    expect(wide.mobileScale).toBeCloseTo(1.12);
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
