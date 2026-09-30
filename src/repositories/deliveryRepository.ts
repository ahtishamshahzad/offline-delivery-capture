import { getDb } from '@/database/database';
import { rowToDelivery, type Delivery, type DeliveryRow, type NewDeliveryInput } from '@/types/delivery';
import { idempotencyKeyFor } from '@/utils/uuid';

type Listener = () => void;

export interface FailureUpdate {
  errorMessage: string;
  retryCount: number;
  /** null = no automatic retry; the user must press Retry. */
  nextAttemptAt: number | null;
}

/**
 * Everything the sync engine needs from storage. The SQLite implementation
 * below is the real one; tests use an in-memory fake with the same contract.
 */
export interface DeliveryStore {
  getDueDeliveries(now: number): Promise<Delivery[]>;
  getNextScheduledAttempt(): Promise<number | null>;
  /** queued|due-failed → uploading, atomically. False if another run claimed it or it's not due. */
  claimForUpload(id: string, now: number): Promise<boolean>;
  markSynced(id: string, remoteId: string, replayed: boolean, now: number): Promise<void>;
  markFailed(id: string, update: FailureUpdate, now: number): Promise<void>;
  /** Rows left in `uploading` by a killed process go back to `queued`. Returns how many. */
  recoverInterrupted(now: number): Promise<number>;
  resetForManualRetry(id: string, now: number): Promise<boolean>;
}

const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** A due row: queued, or failed with an automatic retry whose time has come. */
const DUE_CONDITION = `(status = 'queued' OR (status = 'failed' AND next_attempt_at IS NOT NULL AND next_attempt_at <= $now))`;

export const deliveryRepository = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Idempotent on `id`: saving the same draft twice creates one row. Returns true if inserted. */
  async create(input: NewDeliveryInput, now: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync(
      `INSERT INTO deliveries
         (id, supplier_name, po_number, note, photo_path, status, retry_count,
          created_at, updated_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      input.id,
      input.supplierName,
      input.poNumber,
      input.note,
      input.photoPath,
      now,
      now,
      idempotencyKeyFor(input.id),
    );
    if (result.changes > 0) notify();
    return result.changes > 0;
  },

  async listAll(): Promise<Delivery[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<DeliveryRow>('SELECT * FROM deliveries ORDER BY created_at DESC');
    return rows.map(rowToDelivery);
  },

  async getById(id: string): Promise<Delivery | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<DeliveryRow>('SELECT * FROM deliveries WHERE id = ?', id);
    return row ? rowToDelivery(row) : null;
  },

  async getLastSynced(): Promise<Delivery | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<DeliveryRow>(
      `SELECT * FROM deliveries WHERE status = 'synced' ORDER BY updated_at DESC LIMIT 1`,
    );
    return row ? rowToDelivery(row) : null;
  },

  async getDueDeliveries(now: number): Promise<Delivery[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<DeliveryRow>(
      `SELECT * FROM deliveries WHERE ${DUE_CONDITION} ORDER BY created_at ASC`,
      { $now: now },
    );
    return rows.map(rowToDelivery);
  },

  async getNextScheduledAttempt(): Promise<number | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ next: number | null }>(
      `SELECT MIN(next_attempt_at) AS next FROM deliveries
       WHERE status = 'failed' AND next_attempt_at IS NOT NULL`,
    );
    return row?.next ?? null;
  },

  async claimForUpload(id: string, now: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync(
      `UPDATE deliveries
       SET status = 'uploading', last_attempt_at = $now, updated_at = $now
       WHERE id = $id AND ${DUE_CONDITION}`,
      { $id: id, $now: now },
    );
    if (result.changes > 0) notify();
    return result.changes === 1;
  },

  async markSynced(id: string, remoteId: string, replayed: boolean, now: number): Promise<void> {
    const db = await getDb();
    const result = await db.runAsync(
      `UPDATE deliveries
       SET status = 'synced', remote_id = ?, remote_replayed = ?, error_message = NULL,
           next_attempt_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'uploading'`,
      remoteId,
      replayed ? 1 : 0,
      now,
      id,
    );
    if (result.changes > 0) notify();
  },

  async markFailed(id: string, update: FailureUpdate, now: number): Promise<void> {
    const db = await getDb();
    const result = await db.runAsync(
      `UPDATE deliveries
       SET status = 'failed', error_message = ?, retry_count = ?, next_attempt_at = ?, updated_at = ?
       WHERE id = ? AND status = 'uploading'`,
      update.errorMessage,
      update.retryCount,
      update.nextAttemptAt,
      now,
      id,
    );
    if (result.changes > 0) notify();
  },

  async recoverInterrupted(now: number): Promise<number> {
    const db = await getDb();
    const result = await db.runAsync(
      `UPDATE deliveries SET status = 'queued', updated_at = ? WHERE status = 'uploading'`,
      now,
    );
    if (result.changes > 0) notify();
    return result.changes;
  },

  /** Dev-only: wipe every local delivery (used to start a demo from scratch). */
  async deleteAll(): Promise<number> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM deliveries');
    notify();
    return result.changes;
  },

  async resetForManualRetry(id: string, now: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync(
      `UPDATE deliveries
       SET status = 'queued', retry_count = 0, next_attempt_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'failed'`,
      now,
      id,
    );
    if (result.changes > 0) notify();
    return result.changes > 0;
  },
};

/** The sync engine's view of the repository (compile-time contract check). */
export const deliveryStore: DeliveryStore = deliveryRepository;
