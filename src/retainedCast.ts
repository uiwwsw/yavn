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
  const nextById = new Map(next.map(actor => [actor.slot.id, actor]));
  const previousIds = new Set(previous.map(actor => actor.slot.id));
  // Position is a pose, not DOM order. Reordering keyed siblings still detaches
  // and reinserts DOM nodes, interrupting CSS movement and expression dissolves.
  const retained = previous.map(actor => nextById.get(actor.slot.id)
    ?? { ...actor, visible: false, retiredAt: actor.retiredAt ?? now });
  return [...retained, ...next.filter(actor => !previousIds.has(actor.slot.id))];
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
