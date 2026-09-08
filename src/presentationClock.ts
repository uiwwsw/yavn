/** Story time stops behind loading covers; I/O and asset watchdogs keep wall time. */
export class PresentationClock {
  private sequence = 0;
  private jobs = new Map<number, { callback: () => void; remaining: number; due: number; timer?: number }>();
  private pausedAt: number | undefined;
  private pausedDuration = 0;
  constructor(private host: { now: () => number; set: (fn: () => void, ms: number) => number; clear: (id: number) => void }) {}
  get paused() { return this.pausedAt !== undefined; }
  get now() { return this.at(this.host.now()); }
  at(timestamp: number) { return (this.pausedAt ?? timestamp) - this.pausedDuration; }
  set(callback: () => void, ms: number): number {
    const id = ++this.sequence;
    this.jobs.set(id, { callback, remaining: Math.max(0, ms), due: 0 });
    if (!this.paused) this.arm(id);
    return id;
  }
  clear(id: number) {
    const job = this.jobs.get(id);
    if (job?.timer !== undefined) this.host.clear(job.timer);
    this.jobs.delete(id);
  }
  clearAll() { for (const id of this.jobs.keys()) this.clear(id); }
  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    const now = this.host.now();
    if (paused) {
      this.pausedAt = now;
      for (const job of this.jobs.values()) {
        job.remaining = Math.max(0, job.due - now);
        if (job.timer !== undefined) this.host.clear(job.timer);
        job.timer = undefined;
      }
    } else {
      this.pausedDuration += now - this.pausedAt!;
      this.pausedAt = undefined;
      for (const id of this.jobs.keys()) this.arm(id);
    }
  }
  private arm(id: number) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.due = this.host.now() + job.remaining;
    job.timer = this.host.set(() => {
      this.jobs.delete(id);
      job.callback();
    }, job.remaining);
  }
}
