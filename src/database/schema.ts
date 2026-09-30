/**
 * DDL constants. These run through `execAsync`, which does not escape
 * parameters — keep this file free of any user input.
 */
export const CREATE_DELIVERIES_TABLE = `
CREATE TABLE IF NOT EXISTS deliveries (
  id               TEXT PRIMARY KEY NOT NULL,
  supplier_name    TEXT NOT NULL,
  po_number        TEXT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  photo_path       TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('queued','uploading','synced','failed')),
  retry_count      INTEGER NOT NULL DEFAULT 0,
  next_attempt_at  INTEGER,
  last_attempt_at  INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  remote_id        TEXT,
  remote_replayed  INTEGER NOT NULL DEFAULT 0,
  idempotency_key  TEXT NOT NULL UNIQUE,
  error_message    TEXT
);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status, next_attempt_at);
`;

export const CREATE_APP_SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
