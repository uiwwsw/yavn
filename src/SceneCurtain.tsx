import { useLayoutEffect, useState } from 'react';

/** Retain the loading cover while the decoded stage is revealed. */
export function useSceneCurtain(active: boolean): boolean {
  const [retained, setRetained] = useState(active);
  useLayoutEffect(() => {
    if (active) { setRetained(true); return; }
    if (!retained) return;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 440;
    const timer = window.setTimeout(() => setRetained(false), duration);
    return () => window.clearTimeout(timer);
  }, [active, retained]);
  return active || retained;
}

export function SceneCurtain({ loading, progress, chapter, title }: {
  loading: boolean; progress: number; chapter: number; title?: string;
}) {
  const percent = Math.floor(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className={`chapter-loading scene-curtain${loading ? '' : ' is-revealing'}`} role="status" aria-live="polite">
      <div className="scene-curtain-center">
        <span className="scene-curtain-ornament" aria-hidden="true">◇</span>
        <p>CHAPTER {String(Math.max(1, chapter)).padStart(2, '0')}</p>
        <h2>{title ?? '다음 이야기'}</h2>
        <span>{loading ? '장면을 준비하고 있습니다' : '이야기가 이어집니다'}</span>
      </div>
      <div className="chapter-loading-bar" role="progressbar" aria-label="챕터 로딩"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}
