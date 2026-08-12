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
      compositionScale: 1.58,
      mobileCompositionScale: 1.58,
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
      compositionScale: 1.58,
      zoomOriginX: 'calc(50cqw + min(27.5cqw, 286px))',
      mobileZoomOriginX: '75cqw',
      zoomOriginY: 50,
    });
    expect(close.zoomScale).toBeCloseTo(2.02 / 1.58);
    expect(close.mobileZoomScale).toBeCloseTo(1.84 / 1.58);
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
      compositionScale: 1.58,
      mobileCompositionScale: 1.58,
      compositionOriginY: 80,
      mobileCompositionOriginY: 80,
      zoomOriginX: '50cqw',
      mobileZoomOriginX: '50cqw',
      zoomOriginY: 50,
    });
    expect(close.zoomScale).toBeCloseTo(2.02 / 1.58);
    expect(close.mobileZoomScale).toBeCloseTo(1.84 / 1.58);
    expect(medium).toMatchObject({
      compositionScale: 1.58,
      mobileCompositionScale: 1.58,
      zoomScale: 1,
      mobileZoomScale: 1,
      compositionOriginY: 80,
      mobileCompositionOriginY: 80,
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
      zoomOriginX: 'calc(50cqw - min(25cqw, 260px))',
      mobileZoomOriginX: '25cqw',
    });
    expect(duoClose.zoomScale).toBeCloseTo(2.02 / 1.58);
    expect(duoClose.mobileZoomScale).toBeCloseTo(1.84 / 1.58);

    expect(medium.compositionScale).toBe(duoMedium.compositionScale);
    expect(medium.compositionScale).toBe(
      resolveStageCameraPresentation(
        resolveStageCameraState({ shot: 'medium' }),
        3,
        undefined,
        trioLayout,
      ).compositionScale,
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

      expect(medium.compositionScale).toBe(1.58);
      expect(medium.compositionOriginY).toBe(80);
      expect(wide.zoomScale * wide.compositionScale).toBeCloseTo(1);
      expect(close.zoomScale * close.compositionScale).toBeCloseTo(2.02);
      expect(reaction.zoomScale * reaction.compositionScale).toBeCloseTo(1.83);
      expect(wide.mobileZoomScale * wide.mobileCompositionScale).toBeCloseTo(1);
      expect(medium.mobileZoomScale * medium.mobileCompositionScale).toBeCloseTo(1.58);
      expect(close.mobileZoomScale * close.mobileCompositionScale).toBeCloseTo(1.84);
      expect(reaction.mobileZoomScale * reaction.mobileCompositionScale).toBeCloseTo(1.72);
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

    expect(close.zoomScale * close.compositionScale).toBeCloseTo(2.02);
    expect(close.mobileZoomScale * close.mobileCompositionScale).toBeCloseTo(1.84);
    expect(close.mobileZoomScale).toBeLessThan(close.zoomScale);
    expect(1.84 / 1.58).toBeLessThan(1.2);
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
      compositionScale: 1.58,
      zoomScale: 1,
      mobileZoomScale: 1,
      mobileCompositionOriginY: 80,
    });
    expect(untargetedReaction).toMatchObject({
      shot: 'medium',
      compositionScale: 1.58,
      zoomScale: 1,
      mobileZoomScale: 1,
      mobileCompositionOriginY: 80,
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
    expect(wide.zoomScale).toBeCloseTo(1 / 1.58);
    expect(wide.mobileZoomScale).toBeCloseTo(1 / 1.58);
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
