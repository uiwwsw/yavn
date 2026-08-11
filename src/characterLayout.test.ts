import { describe, expect, it } from 'vitest';
import {
  buildImageCharacterRenderKey,
  resolveCharacterFacingScale,
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

  it('keeps the authored layout for zero, one, or three visible characters', () => {
    expect(resolveCharacterStageLayout([]).mode).toBe('default');
    expect(resolveCharacterStageLayout([
      { id: '코난', position: 'center' },
    ]).mode).toBe('default');
    expect(resolveCharacterStageLayout([
      { id: '란', position: 'left' },
      { id: '코난', position: 'center' },
      { id: '코고로', position: 'right' },
    ]).mode).toBe('default');
  });

  it('keeps an image character mounted while only its emotion source changes', () => {
    expect(buildImageCharacterRenderKey('left', '란')).toBe('left-란');
    expect(buildImageCharacterRenderKey('left', '란')).not.toContain('.webp');
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
