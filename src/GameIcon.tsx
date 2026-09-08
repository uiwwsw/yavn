import type { CSSProperties } from 'react';

const paths = {
  log: 'M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3Zm0 14h14M9 7h6M9 11h6',
  bag: 'M5 8h14l1 12H4L5 8Zm4 0V6a3 3 0 0 1 6 0v2M9 12v1m6-1v1',
  menu: 'M4 6h16M4 12h16M4 18h16M9 4v4m6 2v4m-6 2v4',
  close: 'm6 6 12 12M18 6 6 18',
  play: 'm8 5 11 7-11 7V5Z',
  pause: 'M8 5v14M16 5v14',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm7 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
} as const;

export function GameIcon({ name, className = '', style }: { name: keyof typeof paths; className?: string; style?: CSSProperties }) {
  return <svg className={`game-icon ${className}`} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
