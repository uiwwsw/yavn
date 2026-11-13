import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { CHARACTER_MOTIONS, type CharacterMotion } from './characterEmotes';

export type CharacterEmoteProps = {
  motion?: CharacterMotion;
  motionRepeat?: number;
  motionRevision?: number;
  motionSettled?: boolean;
  /** Which way the art looks in its own (unflipped) frame: -1 left, 1 right, 0 front. */
  motionForward?: number;
};

type Props = CharacterEmoteProps & { children: ReactNode };

/**
 * Body-language layer. It sits inside the actor, so the outer `.char` keeps owning
 * position, scale, facing and combat while this layer only adds a local pose.
 */
export function CharacterEmote({ motion, motionRepeat = 1, motionRevision = 0, motionSettled, motionForward = 0, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const preset = motion ? CHARACTER_MOTIONS[motion] : undefined;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !motion || motionSettled) return;
    // Same motion requested again: restart the CSS animation without remounting the art.
    element.style.animationName = 'none';
    void element.offsetWidth;
    element.style.animationName = '';
  }, [motion, motionRevision, motionSettled]);

  return (
    <div
      ref={ref}
      className="character-emote"
      data-motion={motion}
      data-motion-hold={preset?.hold ? 'true' : undefined}
      data-motion-settled={motionSettled ? 'true' : undefined}
      style={{
        '--emote-duration': `${preset?.duration ?? 0}ms`,
        '--emote-repeat': preset?.hold ? 1 : motionRepeat,
        '--emote-forward': motionForward,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
