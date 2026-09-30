# 0003 — Recover `uploading` rows on launch, before the first sync

**Status:** Accepted · 2026-09-30

## Context
If the process dies mid-request, the row stays `uploading` forever unless something resets it. The server may or may not have stored the delivery.

## Decision
- `status = 'uploading'` is committed **before** the request (the claim step in [0002](0002-idempotency-key-and-atomic-claim.md)).
- `SyncEngine.start()` first runs `UPDATE deliveries SET status = 'queued' WHERE status = 'uploading'`, then subscribes to triggers and starts the first sync.
- `start()` resolves once recovery is done; the first sync runs in the background, so app launch never waits on the network.

## Consequences
- Recovery is safe without any timestamp heuristics: one JS process owns the database, so nothing can really be mid-upload at cold start.
- The re-send uses the same idempotency key. If the server already stored it, the result is `replayed: true` and no duplicate is created.
- Verified on the iOS Simulator: the app was killed during an 8 s upload; after relaunch it logged `recovered 1 interrupted upload(s)`, and the server logged `NEW` then `REPLAY` with the same `remoteId` (see [testing.md](../../testing.md)).

## Alternatives rejected
- **A stale-lock timeout** (e.g. reset `uploading` older than N minutes): it needs a tuning value and still races with a slow in-flight request.
- **Awaiting the first sync in `start()`:** a dead server would block app launch for up to the 15 s timeout.
