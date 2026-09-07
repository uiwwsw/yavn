import type { AttackDirective, AttackPresentation, BackgroundDirective, BackgroundPresentation } from './types';

export const DEFAULT_BACKGROUND_PRESENTATION: BackgroundPresentation = {
  transition: 'dissolve', duration: 620, revision: 0,
};

export function backgroundId(directive: BackgroundDirective): string {
  return typeof directive === 'string' ? directive : directive.id;
}

export function normalizeBackground(directive: BackgroundDirective) {
  const options: Partial<Exclude<BackgroundDirective, string>> = typeof directive === 'string' ? {} : directive;
  const transition = options.transition ?? 'dissolve';
  return {
    transition,
    duration: transition === 'cut' ? 0 : (options.duration ?? 620),
    wait: typeof directive !== 'string' && options.wait !== false,
  };
}

export function normalizeAttack(attack: AttackDirective, revision: number): AttackPresentation {
  return {
    attacker: attack.attacker,
    target: attack.target ?? 'player',
    from: attack.from ?? 'right',
    style: attack.style ?? 'slash',
    strength: attack.strength ?? 'heavy',
    anticipation: attack.anticipation ?? 520,
    impact: attack.impact ?? 160,
    recovery: attack.recovery ?? 620,
    caption: attack.caption,
    image: attack.image,
    phase: 'anticipation',
    revision,
  };
}

export function attackDuration(attack: AttackPresentation): number {
  return attack.anticipation + attack.impact + attack.recovery;
}
