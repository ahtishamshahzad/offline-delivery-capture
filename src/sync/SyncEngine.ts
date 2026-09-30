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
 *
 * End-to-end flow of one delivery (docs/mobile/sync.md has the full version):
 *
 *   Save (useCreateDelivery)
 *     └─ photo copied, INSERT status='queued'            → enters the queue
 *          └─ requestSync('created')
 *               ├─ offline → runOnce() returns early      → stays queued until 'reconnect'
 *               └─ online  → processDueDeliveries → uploadDelivery:
 *                    claimForUpload: status='uploading'   → leaves the queue (committed before the request)
 *                    HttpDeliveryApi.uploadDelivery       → POST /deliveries + Idempotency-Key
 *                      ├─ success → markSynced            → status='synced', done for good
 *                      └─ error   → markFailed            → status='failed' + next_attempt_at
 *                           ├─ retry time passes → backoff timer → due again → claimed again
 *                           └─ retries used up (NULL) → rejoins only via manual Retry
 *
 * "The queue" is not a separate structure: it is the rows matching
 * DUE_CONDITION in deliveryRepository (queued, or failed with a retry now due).
 *
 * Triggers (SyncReason):
 *   startup       start(), after recoverInterrupted()
 *   reconnect     NetInfo offline → online (network.subscribe in start())
 *   foreground    AppState 'active' (wired in sync/index.ts)
 *   queue-focus   QueueScreen useFocusEffect
 *   created       useCreateDelivery after the INSERT
 *   backoff-timer scheduleNextRetry(), earliest next_attempt_at
 *   manual        retryDelivery() in sync/index.ts
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

    // A killed process leaves rows in 'uploading'; put them back in the queue
    // before anything else. Re-sending is safe: same Idempotency-Key.
    const recovered = await this.deps.store.recoverInterrupted(this.deps.clock());
    if (recovered > 0) this.deps.log?.(`recovered ${recovered} interrupted upload(s)`);

    this.unsubscribers.push(
      this.deps.network.subscribe((online) => {
        // React only to offline → online, not to every NetInfo event.
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
      // Upload every due row (see uploadDelivery for the per-row status changes).
      await processDueDeliveries(this.deps);
      // Failed rows with a future next_attempt_at rejoin the queue when this fires.
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
