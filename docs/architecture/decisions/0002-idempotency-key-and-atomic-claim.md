# 0002 — Stable idempotency key + atomic claim against duplicates

**Status:** Accepted · 2026-09-30

## Context
Uploads are retried after timeouts, failures and app kills. A retry after the server already stored the delivery must not create a second record. Two sync triggers firing together must not upload the same row twice.

## Decision
1. **Server side:** each delivery gets `idempotency_key = delivery-<uuid>` once, at creation (`UNIQUE` in SQLite). Every upload sends it as `Idempotency-Key`. The server stores `key → remoteId` **before** it responds, and answers repeats with `200 { remoteId, replayed: true }`. The same key with a different payload returns `422`.
2. **Client side:**
   - `SyncEngine` is single-flight: requests that arrive during a run schedule exactly one follow-up run.
   - Each row is claimed with one conditional `UPDATE … WHERE id = ? AND <due>`, and the upload goes ahead only if `changes === 1`.
   - Result writes are guarded with `AND status = 'uploading'`.
3. **Capture:** the form's id is generated once per form, the Save button locks while saving, and the insert uses `ON CONFLICT(id) DO NOTHING`.

## Consequences
- A retry is always safe, whatever state the server was in.
- `remote_replayed` records when deduplication happened; the details screen shows it.
- A correction made during the build: the claim must *exclude* failed rows with `next_attempt_at IS NULL`. Those have run out of automatic retries and wait for a manual Retry. The original plan's condition (`IS NULL OR <= now`) would have picked them up again.

## Alternatives rejected
- **Deduplicating on the local id alone:** it works, but the header is the standard contract and keeps the server decoupled from client ids.
- **A new key per attempt:** it would defeat deduplication after a kill.
- **An in-memory lock only:** it doesn't survive a restart and doesn't protect against a stale row snapshot.
