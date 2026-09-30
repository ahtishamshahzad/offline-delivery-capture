import { processDueDeliveries } from './syncQueue';
import type { SyncDeps } from './types';

export type SyncReason =
  | 'startup'
  | 'foreground'
  | 'reconnect'
  | 'queue-focus'
  | 'created'
  | 'backoff-timer'
  | 'manual';

/**
 * Drives uploads. Guarantees:
 * - single-flight: at most one run at a time; requests during a run cause
 *   exactly one follow-up run, so no trigger is lost;
 * - recovery: rows stuck in `uploading` from a killed process are re-queued
 *   before the first run;
 * - offline is not an error: runs are skipped and resume on reconnect.
 */
export class SyncEngine {
  private running: Promise<void> | null = null;
  private rerunRequested = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: (() => void)[] = [];
  private lastOnline: boolean | null = null;
  private started = false;

  constructor(private readonly deps: SyncDeps) {}

  /**
   * Call once at app startup. Resolves after recovery; the first sync runs in
   * the background (await `whenIdle()` to wait for it).
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const recovered = await this.deps.store.recoverInterrupted(this.deps.clock());
    if (recovered > 0) this.deps.log?.(`recovered ${recovered} interrupted upload(s)`);

    this.unsubscribers.push(
      this.deps.network.subscribe((online) => {
        const cameBackOnline = this.lastOnline === false && online;
        this.lastOnline = online;
        if (cameBackOnline) void this.requestSync('reconnect');
      }),
    );
    if (this.deps.subscribeForeground) {
      this.unsubscribers.push(this.deps.subscribeForeground(() => void this.requestSync('foreground')));
    }

    void this.requestSync('startup');
  }

  stop(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.clearRetryTimer();
    this.started = false;
  }

  /** Resolves once a run that started after this call has finished. */
  requestSync(reason: SyncReason): Promise<void> {
    this.deps.log?.(`sync requested: ${reason}`);
    this.rerunRequested = true;
    if (!this.running) this.running = this.drain();
    return this.running;
  }

  /** Resolves when the current run (if any) finishes. Useful for tests. */
  whenIdle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  private async drain(): Promise<void> {
    try {
      while (this.rerunRequested) {
        this.rerunRequested = false;
        await this.runOnce();
      }
    } finally {
      // Cleared synchronously with the loop exit, so no request can slip
      // between "loop decided to stop" and "running reset".
      this.running = null;
    }
  }

  private async runOnce(): Promise<void> {
    this.clearRetryTimer();
    try {
      if (!(await this.deps.network.isOnline())) return; // reconnect will trigger us
      await processDueDeliveries(this.deps);
      await this.scheduleNextRetry();
    } catch (error) {
      // Storage errors must never kill the engine; the next trigger retries.
      this.deps.log?.(`sync run failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async scheduleNextRetry(): Promise<void> {
    const next = await this.deps.store.getNextScheduledAttempt();
    if (next === null) return;
    const delay = Math.max(0, next - this.deps.clock());
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.requestSync('backoff-timer');
    }, delay);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
