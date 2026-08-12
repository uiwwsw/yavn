import { describe, expect, it } from 'vitest';
import {
  buildImageCharacterRenderKey,
  resolveCharacterFacingScale,
  resolveCharacterFocusPresentation,
  resolveCharacterFramingScale,
  resolveMobileCameraPan,
  resolveCharacterStagePlacement,
  resolveCharacterStageLayout,
  resolveDialogueVisibleCharacterIds,
} from './characterLayout';

describe('character stage layout', () => {
  it('turns directional art inward while leaving front-facing and solo center art unchanged', () => {
    expect(resolveCharacterFacingScale('left', 'right')).toBe(1);
    expect(resolveCharacterFacingScale('left', 'left')).toBe(-1);
    expect(resolveCharacterFacingScale('right', 'left')).toBe(1);
    expect(resolveCharacterFacingScale('right', 'right')).toBe(-1);
    expect(resolveCharacterFacingScale('front', 'left')).toBe(1);
    expect(resolveCharacterFacingScale('left', 'center')).toBe(1);
    expect(resolveCharacterFacingScale('left', 'center', 'left')).toBe(-1);
    expect(resolveCharacterFacingScale(undefined, 'right')).toBe(1);
  });

  it('places exactly two visible characters in stable left and right halves', () => {
    expect(resolveCharacterStageLayout([
      { id: '란', position: 'left' },
      { id: '코고로', position: 'right' },
    ])).toEqual({
      mode: 'duo',
      duoSideByPosition: {
        left: 'left',
        right: 'right',
      },
      characterIdByPosition: {
        left: '란',
        right: '코고로',
      },
    });

    expect(resolveCharacterStageLayout([
      { id: '코고로', position: 'right' },
      { id: '코난', position: 'center' },
    ])).toEqual({
      mode: 'duo',
      duoSideByPosition: {
        center: 'left',
        right: 'right',
      },
      characterIdByPosition: {
        center: '코난',
        right: '코고로',
      },
    });
  });

  it('uses slot order instead of speaker order so characters never swap sides', () => {
    expect(resolveCharacterStageLayout([
      { id: '코난', position: 'center' },
      { id: '란', position: 'left' },
    ])).toEqual({
      mode: 'duo',
      duoSideByPosition: {
        left: 'left',
        center: 'right',
      },
      characterIdByPosition: {
        left: '란',
        center: '코난',
      },
    });
  });

  it('keeps a surviving character in the same duo half without resizing', () => {
    const duoLayout = resolveCharacterStageLayout([
      { id: '코난', position: 'center' },
      { id: '코고로', position: 'right' },
    ]);

    expect(resolveCharacterStageLayout([
      { id: '코고로', position: 'right' },
    ], duoLayout)).toEqual({
      mode: 'duo',
      duoSideByPosition: {
        right: 'right',
      },
      characterIdByPosition: {
        right: '코고로',
      },
    });
  });

  it('does not inherit a duo half when the actor is replaced or changes slots', () => {
    const duoLayout = resolveCharacterStageLayout([
      { id: '코난', position: 'center' },
      { id: '코고로', position: 'right' },
    ]);

    expect(resolveCharacterStageLayout([
      { id: '란', position: 'right' },
    ], duoLayout).mode).toBe('default');
    expect(resolveCharacterStageLayout([
      { id: '코고로', position: 'center' },
    ], duoLayout).mode).toBe('default');
  });

  it('clears the remembered duo placement after the stage becomes empty', () => {
    const duoLayout = resolveCharacterStageLayout([
      { id: '코난', position: 'center' },
      { id: '코고로', position: 'right' },
    ]);
    const emptyLayout = resolveCharacterStageLayout([], duoLayout);

    expect(emptyLayout.mode).toBe('default');
    expect(resolveCharacterStageLayout([
      { id: '코고로', position: 'right' },
    ], emptyLayout).mode).toBe('default');
  });

  it('uses a dedicated trio layout while preserving authored solo slots', () => {
    expect(resolveCharacterStageLayout([]).mode).toBe('default');
    expect(resolveCharacterStageLayout([
      { id: '코난', position: 'center' },
    ]).mode).toBe('default');
    expect(resolveCharacterStageLayout([
      { id: '란', position: 'left' },
      { id: '코난', position: 'center' },
      { id: '코고로', position: 'right' },
    ])).toMatchObject({
      mode: 'trio',
      characterIdByPosition: {
        left: '란',
        center: '코난',
        right: '코고로',
      },
    });
  });

  it('caps desktop ensemble gaps and lets asset calibration tune the footprint', () => {
    const trio = resolveCharacterStageLayout([
      { id: '아진', position: 'left' },
      { id: '덕만', position: 'center' },
      { id: '월명', position: 'right' },
    ]);

    expect(resolveCharacterStagePlacement('left', trio, 0.9)).toEqual({
      anchorX: 'calc(50cqw - min(16.2cqw, 234px))',
      offsetX: '-50%',
      panToCenterX: 'min(16.2cqw, 234px)',
    });
    expect(resolveCharacterStagePlacement('right', trio, 1.15)).toEqual({
      anchorX: 'calc(50cqw + min(20.7cqw, 299px))',
      offsetX: '-50%',
      panToCenterX: 'calc(0px - min(20.7cqw, 299px))',
    });
  });

  it('uses a separate capped gap for a desktop duo and center-based solo anchors', () => {
    const duo = resolveCharacterStageLayout([
      { id: '덕만', position: 'center' },
      { id: '진평왕', position: 'right' },
    ]);
    expect(resolveCharacterStagePlacement('center', duo)).toEqual({
      anchorX: 'calc(50cqw - min(22cqw, 260px))',
      offsetX: '-50%',
      panToCenterX: 'min(22cqw, 260px)',
    });
    expect(resolveCharacterStagePlacement('left', resolveCharacterStageLayout([
      { id: '덕만', position: 'left' },
    ]))).toEqual({
      anchorX: '25cqw',
      offsetX: '-50%',
      panToCenterX: '25cqw',
    });
    expect(resolveCharacterStagePlacement('right', resolveCharacterStageLayout([
      { id: '진평왕', position: 'right' },
    ]))).toEqual({
      anchorX: '75cqw',
      offsetX: '-50%',
      panToCenterX: '-25cqw',
    });
  });

  it('centers camera targets against the unchanged mobile duo and trio partitions', () => {
    const duo = resolveCharacterStageLayout([
      { id: '덕만', position: 'center' },
      { id: '진평왕', position: 'right' },
    ]);
    const trio = resolveCharacterStageLayout([
      { id: '덕만', position: 'left' },
      { id: '천명', position: 'center' },
      { id: '진평왕', position: 'right' },
    ]);
    expect(resolveMobileCameraPan('center', duo)).toBe('25cqw');
    expect(resolveMobileCameraPan('right', duo)).toBe('-25cqw');
    expect(resolveMobileCameraPan('left', trio)).toBe('35cqw');
    expect(resolveMobileCameraPan('right', trio)).toBe('-35cqw');
    expect(resolveMobileCameraPan('left', resolveCharacterStageLayout([
      { id: '덕만', position: 'left' },
    ]))).toBe('25cqw');
  });

  it('keeps an image character mounted across emotion and position changes', () => {
    expect(buildImageCharacterRenderKey('란')).toBe('character-란');
    expect(buildImageCharacterRenderKey('란')).not.toContain('left');
    expect(buildImageCharacterRenderKey('란')).not.toContain('.webp');
  });

  it('reduces framing zoom as the cast grows without shrinking full-body shots', () => {
    expect(resolveCharacterFramingScale(1, 3)).toBe(1);
    expect(resolveCharacterFramingScale(2, 1)).toBe(2);
    expect(resolveCharacterFramingScale(2, 2)).toBeCloseTo(1.82);
    expect(resolveCharacterFramingScale(2, 3)).toBeCloseTo(1.62);
  });

  it('keeps the current speaker foremost and quiets listeners more strongly in a trio', () => {
    expect(resolveCharacterFocusPresentation(3, 1, true, true)).toEqual({
      brightness: 1,
      scaleMultiplier: 1,
      depthClass: 'is-speaker',
    });
    expect(resolveCharacterFocusPresentation(3, 2, false, true).brightness).toBe(0.76);
    expect(resolveCharacterFocusPresentation(3, 3, false, true).brightness).toBe(0.64);
    expect(resolveCharacterFocusPresentation(3, 2, false, false)).toEqual({
      brightness: 1,
      scaleMultiplier: 1,
      depthClass: 'is-neutral',
    });
  });

  it('keeps the staged ensemble visible until the script explicitly narrows the shot', () => {
    expect(resolveDialogueVisibleCharacterIds(
      ['덕만', '아진', '칠숙'],
      '덕만',
      undefined,
    )).toEqual(['덕만', '아진', '칠숙']);

    expect(resolveDialogueVisibleCharacterIds(
      ['덕만', '아진', '칠숙'],
      '덕만',
      ['아진'],
    )).toEqual(['덕만', '아진']);

    expect(resolveDialogueVisibleCharacterIds(
      ['덕만', '아진', '칠숙'],
      '덕만',
      [],
    )).toEqual(['덕만']);
  });

  it('lets narration establish the full cast or deliberately clear the stage', () => {
    expect(resolveDialogueVisibleCharacterIds(['덕만', '진평왕'], undefined, undefined))
      .toEqual(['덕만', '진평왕']);
    expect(resolveDialogueVisibleCharacterIds(['덕만', '진평왕'], undefined, []))
      .toEqual([]);
  });
});
