import { useEffect, useState } from 'react';
import type { CharacterSlot, Position } from './types';
import type { CharacterStageRenderPlacement } from './characterLayout';

export type CastActor = {
  slot: CharacterSlot;
  position: Position;
  visible: boolean;
  placement: CharacterStageRenderPlacement;
  retiredAt?: number;
};

/** Retain displaced actors under their original identity and final stage placement. */
export function reconcileCast(previous: readonly CastActor[], next: readonly CastActor[], now: number): CastActor[] {
  const ids = new Set(next.map(actor => actor.slot.id));
  const departing = previous
    .filter(actor => !ids.has(actor.slot.id))
    .map(actor => ({ ...actor, visible: false, retiredAt: actor.retiredAt ?? now }));
  return [...next, ...departing];
}

export function useRetainedCast(next: CastActor[], leaveDuration: number): CastActor[] {
  const [state, setState] = useState(() => ({ input: next, actors: next }));
  // Reconcile before React commits children, so a replaced actor never unmounts
  // for one frame and then reappears as an exit clone.
  if (state.input !== next) {
    setState({ input: next, actors: reconcileCast(state.actors, next, performance.now()) });
  }

  useEffect(() => {
    const deadlines = state.actors.flatMap(actor =>
      actor.retiredAt === undefined ? [] : [actor.retiredAt + leaveDuration]);
    if (!deadlines.length) return;

    const timer = window.setTimeout(() => setState(current => ({
      ...current,
      actors: current.actors.filter(actor =>
        actor.retiredAt === undefined || actor.retiredAt + leaveDuration > performance.now()),
    })), Math.max(0, Math.min(...deadlines) - performance.now()) + 20);
    return () => window.clearTimeout(timer);
  }, [state.actors, leaveDuration]);

  return state.actors;
}
