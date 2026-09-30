# State and local data

All persistent state is in SQLite (`deliveries.db`, opened once by `src/database/database.ts`, WAL mode). React state holds only form input. Why: [ADR 0001](../architecture/decisions/0001-sqlite-outbox-source-of-truth.md).

## `deliveries`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 (`expo-crypto`), generated when the capture form opens |
| `supplier_name`, `po_number`, `note` | TEXT | Trimmed on save |
| `photo_path` | TEXT | **Relative** to the document dir: `photos/<id>.jpg`. The absolute iOS container path can change between installs |
| `status` | TEXT | `CHECK IN ('queued','uploading','synced','failed')` |
| `retry_count` | INTEGER | Failed attempts since creation or the last manual Retry |
| `next_attempt_at` | INTEGER NULL | Epoch ms of the next automatic retry. **NULL on a failed row = needs manual Retry** |
| `last_attempt_at`, `created_at`, `updated_at` | INTEGER | Epoch ms |
| `remote_id` | TEXT NULL | Server id once synced |
| `remote_replayed` | INTEGER | 1 if the server reported the upload as a replay (duplicate prevented) |
| `idempotency_key` | TEXT UNIQUE | `delivery-<id>`, never regenerated |
| `error_message` | TEXT NULL | Short user-facing text of the last failure |

Index: `(status, next_attempt_at)`, which serves the "due" query.

## `app_settings`
Key/value pairs for dev simulations: `failureMode` (`off|server_error|malformed|timeout`) and `uploadDelayMs` (`0|2000|8000`). Unknown values fall back to the defaults.

## Migrations
`src/database/migrations.ts` holds an append-only array. Version = `PRAGMA user_version`; each step runs in a transaction. Never edit a shipped migration; append a new one.

## Repository contract
- **Writes:** `deliveryRepository` in `src/repositories/deliveryRepository.ts` is the only place that writes deliveries.
- **SQL:** every statement is parameterized.
- **Change events:** each write that changes a row calls `notify()`, and subscribers such as `useDeliveries` and `useDelivery` re-query.
- **Sync engine's view:** the engine sees only the `DeliveryStore` interface, which is faked in tests by `test-support/fakes.ts`.
