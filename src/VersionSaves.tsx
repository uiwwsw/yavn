import { useEffect, useRef } from 'react';
import { BUILD_INFO, formatAppVersion, formatContentVersion } from './buildInfo';
import { formatRelativeSaveTime, formatSaveChapter, truncateSaveLine, type SlotLike } from './saveMeta';
import type { ContentVersionChange } from './updateCheck';
import { uiLanguage } from './uiLanguage';

const en = uiLanguage === 'en';

/** "앱 v0.2.0 · 1a2b3c4 · 작품 v1.0.0" — quiet, always there. */
export function VersionLine({ contentVersion, className = 'vs-version-line' }: { contentVersion?: string; className?: string }) {
  const content = formatContentVersion(contentVersion);
  return (
    <p className={className} title={BUILD_INFO.builtAt ? `${en ? 'Built' : '빌드'} ${BUILD_INFO.builtAt}` : undefined}>
      <span>{formatAppVersion()}</span>
      {content && <span>{content}</span>}
    </p>
  );
}

/** Tiny HUD stamp. Rendered inside `.hud-meta-group`; position it with CSS. */
export function VersionStamp({ contentVersion }: { contentVersion?: string }) {
  const content = contentVersion?.trim();
  return (
    <span className="vs-version-stamp" aria-label={`${formatAppVersion()}${content ? `, ${formatContentVersion(content)}` : ''}`}>
      v{BUILD_INFO.build}{content ? ` · ${content}` : ''}
    </span>
  );
}

/** Chapter, last line with its speaker, and how long ago — what a save card needs to be recognised. */
export function SaveSlotMeta({ slot, now, emptyLabel }: { slot?: SlotLike; now?: number; emptyLabel?: string }) {
  if (!slot?.exists) return <span className="vs-slot-meta is-empty">{emptyLabel ?? (en ? 'Empty' : '비어 있음')}</span>;
  const line = truncateSaveLine(slot.line);
  return (
    <span className="vs-slot-meta">
      <span className="vs-slot-chapter">{formatSaveChapter(slot)}</span>
      {line && (
        <span className="vs-slot-line">
          {slot.speaker && <b className="vs-slot-speaker">{slot.speaker}</b>}
          <q>{line}</q>
        </span>
      )}
      <span className="vs-slot-time">
        <time dateTime={slot.savedAt}>{formatRelativeSaveTime(slot.savedAt, now)}</time>
        {slot.versionMismatch && <em className="vs-slot-old">{en ? `Saved in v${slot.savedVersion}` : `v${slot.savedVersion}에서 저장`}</em>}
      </span>
    </span>
  );
}

export function olderVersionMessage(savedVersion?: string): string {
  return en
    ? `This was saved in an earlier version${savedVersion ? ` (v${savedVersion})` : ''}. The story has changed, so your place may differ.`
    : `이전 버전${savedVersion ? `(v${savedVersion})` : ''}에서 저장한 기록이에요. 이야기가 바뀌어 위치가 다를 수 있어요.`;
}

type BannerProps = {
  buildChanged: boolean;
  contentChange?: ContentVersionChange;
  /** Hold the notice while a line is still typing; show it at the next choice or pause. */
  idle: boolean;
  inGame: boolean;
  busy?: boolean;
  onReloadNow: () => void;
  onRestartNewVersion: () => void;
  onContinueNewVersion: () => void;
  onDismissBuild: () => void;
  onDismissContent: () => void;
};

/** Non-blocking notice. Nothing reloads unless the player presses a button. */
export function UpdateBanner(props: BannerProps) {
  const { buildChanged, contentChange, idle, inGame, busy } = props;
  if (!idle || (!buildChanged && !contentChange)) return null;
  if (contentChange && inGame) {
    return (
      <aside className="vs-update-banner is-content" role="status" aria-live="polite" onClick={(event) => event.stopPropagation()}>
        <p>
          <b>{en ? 'This story has been updated' : '이 작품 내용이 바뀌었어요'}</b>
          <span className="vs-update-versions">v{contentChange.from} → v{contentChange.to}</span>
        </p>
        <div className="vs-update-actions">
          <button type="button" className="is-primary" disabled={busy} onClick={props.onRestartNewVersion}>
            {en ? 'Start over in the new version' : '처음부터 새 버전으로'}
          </button>
          <button type="button" disabled={busy} onClick={props.onContinueNewVersion}>{en ? 'Keep going' : '이어서 하기'}</button>
          <button type="button" className="is-quiet" disabled={busy} onClick={props.onDismissContent}>{en ? 'Later' : '나중에'}</button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="vs-update-banner is-build" role="status" aria-live="polite" onClick={(event) => event.stopPropagation()}>
      <p><b>{en ? 'A new version is out. Update now?' : '새 버전이 나왔어요. 지금 반영할까요?'}</b>
        {inGame && <span>{en ? 'You will pick up right where you are.' : '지금 장면에서 그대로 이어집니다.'}</span>}</p>
      <div className="vs-update-actions">
        <button type="button" className="is-primary" disabled={busy} onClick={props.onReloadNow}>{en ? 'Update now' : '지금 반영'}</button>
        <button type="button" className="is-quiet" disabled={busy} onClick={props.onDismissBuild}>{en ? 'Later' : '나중에'}</button>
      </div>
    </aside>
  );
}

/** Shown before loading when the newest save comes from an older version and no start screen asked yet. */
export function VersionGate({ title, slot, currentVersion, busy, onRestart, onContinue }: {
  title?: string;
  slot?: SlotLike;
  currentVersion?: string;
  busy?: boolean;
  onRestart: () => void;
  onContinue: () => void;
}) {
  const continueRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { continueRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="vs-version-gate" role="dialog" aria-modal="true" aria-labelledby="vs-version-gate-title">
      <div className="vs-version-gate-panel">
        {title && <p className="vs-version-gate-game">{title}{currentVersion ? ` · v${currentVersion}` : ''}</p>}
        <h2 id="vs-version-gate-title">{en ? 'The story has been updated' : '이야기가 새로 바뀌었어요'}</h2>
        <p className="vs-older-save-note">{olderVersionMessage(slot?.savedVersion)}</p>
        {slot && <SaveSlotMeta slot={slot} />}
        <div className="vs-version-gate-actions">
          <button type="button" disabled={busy} onClick={onRestart}>{en ? 'Start over' : '처음부터'}</button>
          <button type="button" ref={continueRef} className="is-primary" disabled={busy} onClick={onContinue}>
            {en ? 'Continue anyway' : '그래도 이어하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
