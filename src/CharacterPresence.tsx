import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CharacterEnterEffect } from './types';

type Props = {
  visible: boolean;
  ready: boolean;
  effect: CharacterEnterEffect;
  children: ReactNode;
};

/** Entrance owns only its local pose; the actor's world placement never animates here. */
export function CharacterPresence({ visible, ready, effect, children }: Props) {
  const shown = visible && ready;
  const wasShown = useRef(false);
  const [entrance, setEntrance] = useState({ active: false, effect });

  useLayoutEffect(() => {
    if (shown && !wasShown.current) {
      setEntrance({ active: effect !== 'none', effect });
    }
    wasShown.current = shown;
  }, [shown, effect]);

  return (
    <div className="character-presence" data-visible={shown}>
      <div
        className="character-entrance"
        data-entering={entrance.active}
        data-effect={entrance.effect}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) {
            setEntrance(current => ({ ...current, active: false }));
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
