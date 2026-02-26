import type { CharacterSlot, Position } from './types';

type Live2DLoadStatus = 'ready' | 'error';

const statusByKey = new Map<string, Live2DLoadStatus>();
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function countResolved(keys: string[]): number {
  let resolved = 0;
  for (const key of keys) {
    if (statusByKey.has(key)) {
      resolved += 1;
    }
  }
  return resolved;
}

export function resetLive2DLoadTracker(): void {
  statusByKey.clear();
  notifyListeners();
}

export function buildLive2DLoadKey(position: Position, slot: Pick<CharacterSlot, 'id' | 'source'>): string {
  return `${position}::${slot.id}::${slot.source}`;
}

export function markLive2DLoadReady(key: string): void {
  statusByKey.set(key, 'ready');
  notifyListeners();
}

export function markLive2DLoadError(key: string): void {
  statusByKey.set(key, 'error');
  notifyListeners();
}

export async function waitForLive2DLoad(
  keys: string[],
  timeoutMs: number,
): Promise<{ resolved: number; total: number; timedOut: boolean }> {
  const uniqueKeys = Array.from(new Set(keys.filter((key) => key.trim().length > 0)));
  const total = uniqueKeys.length;
  if (total === 0) {
    return { resolved: 0, total: 0, timedOut: false };
  }

  const initialResolved = countResolved(uniqueKeys);
  if (initialResolved >= total) {
    return { resolved: total, total, timedOut: false };
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = (timedOut: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      listeners.delete(check);
      window.clearTimeout(timer);
      resolve({
        resolved: countResolved(uniqueKeys),
        total,
        timedOut,
      });
    };
    const check = () => {
      if (countResolved(uniqueKeys) >= total) {
        done(false);
      }
    };

    listeners.add(check);
    const timer = window.setTimeout(() => done(true), Math.max(0, timeoutMs));
    check();
  });
}
