import { uiLanguage } from '../uiLanguage';
import { formatBytes, planOfflineDownload } from './offlinePacks';
import type { OfflineGameState } from './useOffline';

const en = uiLanguage === 'en';

export const offlineCopy = {
  note: en ? 'Offline · Only saved games can be opened' : '오프라인 · 저장한 게임만 열 수 있어요',
  unavailable: en ? 'Not saved for offline' : '오프라인에서는 열 수 없어요',
  notSaved: en ? 'Not saved' : '저장 안 됨',
  saving: (percent: number) => (en ? `Saving ${percent}%` : `저장 중 ${percent}%`),
  saved: en ? 'Available offline' : '오프라인 가능',
  outdated: en ? 'Update available' : '업데이트 있음',
  save: (size: string) => (en ? `Save offline · ${size}` : `오프라인 저장 · ${size}`),
  update: (size: string) => (en ? `Save update · ${size}` : `업데이트 저장 · ${size}`),
  remove: en ? 'Remove' : '지우기',
  retry: en ? 'Try again' : '다시 시도',
  tooLarge: (size: string) => (en ? `Too large to save offline (${size})` : `용량이 커서(${size}) 오프라인 저장은 지원하지 않아요`),
  quota: en
    ? 'Not enough storage. Remove another saved game or free up space, then try again.'
    : '저장 공간이 모자라요. 저장한 다른 게임을 지우거나 기기 공간을 비운 뒤 다시 해 주세요.',
  network: en ? 'The connection dropped while saving. Try again once you are online.' : '저장하다 연결이 끊겼어요. 연결되면 다시 해 주세요.',
};

/** Calm strip under the launcher top bar while the site cannot be reached. */
export function OfflineNote() {
  return (
    <p className="launcher-offline-note" role="status">
      <span aria-hidden="true" />{offlineCopy.note}
    </p>
  );
}

/** Save / progress / saved + remove, for the selected game in the spotlight. */
export function OfflinePackControl({ state, reachable, tabIndex, onSave, onRemove }: {
  state: OfflineGameState;
  reachable: boolean;
  tabIndex?: number;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { status, pack, marker, progress, error } = state;
  if (status === 'unsupported') return null;
  if (status === 'too-large') {
    return <p className="launcher-offline-pack is-muted">{offlineCopy.tooLarge(formatBytes(pack?.bytes ?? 0))}</p>;
  }
  const saving = progress !== undefined;
  const percent = Math.floor((progress ?? 0) * 100);
  const label = saving
    ? offlineCopy.saving(percent)
    : status === 'saved' ? offlineCopy.saved : status === 'outdated' ? offlineCopy.outdated : offlineCopy.notSaved;
  const updateBytes = pack ? planOfflineDownload(pack, marker).bytes : 0;

  return (
    <div className={`launcher-offline-pack is-${saving ? 'saving' : status}`}>
      <span className="launcher-offline-status" role="status" aria-live="polite">
        <i aria-hidden="true" />{label}
      </span>
      {saving && (
        <span className="launcher-offline-progress" role="progressbar" aria-label={label}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <i style={{ transform: `scaleX(${Math.max(0.02, progress ?? 0)})` }} />
        </span>
      )}
      {!saving && status === 'not-saved' && pack && (
        <button type="button" className="launcher-offline-action" tabIndex={tabIndex} disabled={!reachable} onClick={onSave}>
          {error ? offlineCopy.retry : offlineCopy.save(formatBytes(pack.bytes))}
        </button>
      )}
      {!saving && status === 'outdated' && (
        <button type="button" className="launcher-offline-action" tabIndex={tabIndex} disabled={!reachable} onClick={onSave}>
          {offlineCopy.update(formatBytes(updateBytes))}
        </button>
      )}
      {!saving && (status === 'saved' || status === 'outdated') && (
        <button type="button" className="launcher-offline-action is-quiet" tabIndex={tabIndex} onClick={onRemove}>
          {offlineCopy.remove}
        </button>
      )}
      {error && !saving && <p className="launcher-offline-error" role="alert">{error === 'quota' ? offlineCopy.quota : offlineCopy.network}</p>}
    </div>
  );
}
