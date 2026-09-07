import type { CSSProperties } from 'react';
import type { AttackPresentation } from './types';

export function CinematicLayer({ attack }: { attack?: AttackPresentation }) {
  if (!attack) return null;
  return (
    <div className="cinematic-layer" data-phase={attack.phase} data-style={attack.style}
      data-from={attack.from} data-strength={attack.strength}
      style={{ '--impact-duration': `${attack.impact}ms`, '--recovery-duration': `${attack.recovery}ms` } as CSSProperties}>
      {attack.image && (
        <div className="cinematic-insert" aria-hidden="true">
          <img src={attack.image} alt="" decoding="async" />
        </div>
      )}
      <div className="cinematic-letterbox" aria-hidden="true" />
      <div className="cinematic-vignette" aria-hidden="true" />
      <div key={`${attack.revision}-${attack.phase}`} className="cinematic-hit" aria-hidden="true">
        <i /><i /><i />
      </div>
      {attack.caption && <p className="cinematic-caption" role="status">{attack.caption}</p>}
      <span className="sr-only" role="status">
        {attack.phase === 'impact' ? `${attack.attacker}의 공격이 ${attack.target === 'player' ? '플레이어' : attack.target}에게 닿습니다.` : ''}
      </span>
    </div>
  );
}
