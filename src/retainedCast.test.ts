import { describe, expect, it } from 'vitest';
import { reconcileCast, type CastActor } from './retainedCast';
import type { CharacterSlot } from './types';

const actor = (id: string, position: CastActor['position'] = 'left'): CastActor => ({
  slot: { id, source: `${id}.webp` } as CharacterSlot,
  position,
  visible: true,
  placement: { anchorX: '25cqw', mobileAnchorX: '25cqw', offsetX: '-50%', facingScale: -1 },
});

describe('cast replacement lifetime', () => {
  it('retains the replaced actor with its old portrait, facing and placement through the exit', () => {
    const old = actor('old');
    const next = actor('new');
    const result = reconcileCast([old], [next], 100);
    expect(result[1]).toBe(next);
    expect(result[0]).toEqual({ ...old, visible: false, retiredAt: 100 });
    expect(result[0].slot).toBe(old.slot);
    expect(result[0].placement).toBe(old.placement);
  });

  it('does not restart an exit deadline when another actor changes expression', () => {
    const result = reconcileCast([actor('old')], [actor('new')], 100);
    expect(reconcileCast(result, [actor('new')], 200)[0].retiredAt).toBe(100);
  });

  it('cancels retirement when the same character returns before the exit completes', () => {
    const result = reconcileCast([actor('old')], [actor('new')], 100);
    const returning = actor('old', 'right');
    const actors = reconcileCast(result, [returning, actor('new')], 150);
    expect(actors).toHaveLength(2);
    expect(actors[0]).toBe(returning);
    expect(actors[0].retiredAt).toBeUndefined();
  });

  it('preserves an actor already fading from a visibility change when its slot is replaced', () => {
    const hidden = { ...actor('old'), visible: false };
    expect(reconcileCast([hidden], [actor('new')], 100)[0]).toEqual({ ...hidden, retiredAt: 100 });
  });

  it('moves the same actor between slots without retaining a duplicate instance', () => {
    const moved = actor('same', 'center');
    expect(reconcileCast([actor('same')], [moved], 100)).toEqual([moved]);
  });

  it('keeps sibling identity order when actors swap positions and expressions together', () => {
    const a = actor('a'), b = actor('b', 'right');
    const movedA = { ...actor('a', 'right'), slot: { ...a.slot, source: 'a-smile.webp' } };
    const movedB = actor('b', 'left');
    // Store order follows stage slots; DOM order follows the existing identities.
    const result = reconcileCast([a, b], [movedB, movedA], 100);
    expect(result).toEqual([movedA, movedB]);
    expect(reconcileCast(result, [movedB, movedA], 200)).toEqual(result);
  });
});
