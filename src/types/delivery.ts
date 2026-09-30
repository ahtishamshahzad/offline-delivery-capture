export type SyncStatus = 'queued' | 'uploading' | 'synced' | 'failed';

/** A delivery as the app sees it. SQLite is the source of truth for these. */
export interface Delivery {
  id: string;
  supplierName: string;
  poNumber: string;
  note: string;
  /** Relative to the app's document directory, e.g. `photos/<id>.jpg`. */
  photoPath: string;
  status: SyncStatus;
  /** Failed attempts since creation or the last manual retry. */
  retryCount: number;
  /** Epoch ms of the next automatic retry; null when none is scheduled. */
  nextAttemptAt: number | null;
  lastAttemptAt: number | null;
  createdAt: number;
  updatedAt: number;
  remoteId: string | null;
  /** True when the server answered that it had already seen this idempotency key. */
  remoteReplayed: boolean;
  idempotencyKey: string;
  errorMessage: string | null;
}

export interface NewDeliveryInput {
  id: string;
  supplierName: string;
  poNumber: string;
  note: string;
  photoPath: string;
}

/** Raw row shape of the `deliveries` table. */
export interface DeliveryRow {
  id: string;
  supplier_name: string;
  po_number: string;
  note: string;
  photo_path: string;
  status: SyncStatus;
  retry_count: number;
  next_attempt_at: number | null;
  last_attempt_at: number | null;
  created_at: number;
  updated_at: number;
  remote_id: string | null;
  remote_replayed: number;
  idempotency_key: string;
  error_message: string | null;
}

export function rowToDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    supplierName: row.supplier_name,
    poNumber: row.po_number,
    note: row.note,
    photoPath: row.photo_path,
    status: row.status,
    retryCount: row.retry_count,
    nextAttemptAt: row.next_attempt_at,
    lastAttemptAt: row.last_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    remoteId: row.remote_id,
    remoteReplayed: row.remote_replayed === 1,
    idempotencyKey: row.idempotency_key,
    errorMessage: row.error_message,
  };
}
