import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { ResourceImage } from './ResourceImage';

export function trapOutcomeFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], [tabindex="0"]',
  ));
  const first = controls[0];
  const last = controls[controls.length - 1];
  if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
}

type Props = {
  kind: 'ending' | 'gameOver';
  title: string;
  message: string;
  epilogue?: string;
  background?: string;
  tone?: 'hopeful' | 'tragic' | 'mystery';
  onContinue: () => void;
};

/** The final scene stays underneath this reveal; reading pace belongs to the player. */
export function OutcomePrelude({ kind, title, message, epilogue, background, tone, onContinue }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { buttonRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="outcome-prelude" data-kind={kind} data-tone={tone ?? (kind === 'gameOver' ? 'tragic' : 'hopeful')}
      role="dialog" aria-modal="true" aria-labelledby="outcome-title" aria-describedby="outcome-message"
      onKeyDown={trapOutcomeFocus}
      onClick={(event) => event.stopPropagation()}>
      {background && <ResourceImage className="outcome-background" src={background} alt="" aria-hidden="true" />}
      <div className="outcome-shade" aria-hidden="true" />
      <div className="outcome-content">
        <div className="outcome-rule" aria-hidden="true"><i /></div>
        <p className="outcome-kicker">{kind === 'gameOver' ? '여기서 멈춘 이야기' : '당신이 도착한 이야기'}</p>
        <h2 id="outcome-title">{title}</h2>
        <p id="outcome-message" className="outcome-message">{message}</p>
        {epilogue && <p className="outcome-epilogue">{epilogue}</p>}
        <button type="button" className="outcome-continue" ref={buttonRef} onClick={onContinue}>
          {kind === 'gameOver' ? '선택을 되돌아보기' : '엔딩 기록과 크레딧'}<span aria-hidden="true"> →</span>
        </button>
        <p className="outcome-footnote">{kind === 'gameOver' ? '지나온 선택에서 이야기를 다시 이어갈 수 있습니다.' : '이 결말은 당신의 선택으로 완성되었습니다.'}</p>
      </div>
    </section>
  );
}
