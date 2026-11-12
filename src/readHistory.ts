// Remembers which dialogue lines a player has already seen, per game, so "skip read text"
// can fast-forward through them and stop at the first line the player has not read.

const MAX_READ_LINES = 20000;

export function readLineKey(chapterPath: string | undefined, sceneId: string, actionIndex: number): string {
  return `${chapterPath ?? ''}#${sceneId}#${actionIndex}`;
}

export class ReadHistory {
  private lines = new Set<string>();
  private storageKey: string | undefined;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;

  load(storageKey: string | undefined): void {
    this.flush();
    this.storageKey = storageKey;
    this.lines = new Set();
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === 'string') this.lines.add(entry);
        }
      }
    } catch {
      // Unreadable history only means lines count as unread again.
    }
  }

  has(key: string): boolean {
    return this.lines.has(key);
  }

  /** Marks a line as read and returns whether it had been read before. */
  markRead(key: string): boolean {
    if (this.lines.has(key)) return true;
    this.lines.add(key);
    if (this.lines.size > MAX_READ_LINES) {
      const oldest = this.lines.values().next().value;
      if (oldest !== undefined) this.lines.delete(oldest);
    }
    this.dirty = true;
    this.scheduleFlush();
    return false;
  }

  get size(): number {
    return this.lines.size;
  }

  flush(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (!this.dirty || !this.storageKey) return;
    this.dirty = false;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.lines]));
    } catch {
      // Storage full or blocked: keep the in-memory history for this session.
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, 1500);
  }
}
