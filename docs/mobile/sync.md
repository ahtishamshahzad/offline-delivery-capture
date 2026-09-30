# Sync engine

**Source:** `src/sync/` · **Wired in:** `src/sync/index.ts` · **Reached from the UI only via** `useSyncQueue` and `useCreateDelivery`.
Concepts and diagrams: root [README §2–4](../../README.md#2-offline-strategy). This page is the reference.

## End-to-end flow: from Save to server

There is **no separate queue structure**. "In the queue" means a `deliveries` row matching `DUE_CONDITION` in `deliveryRepository.ts`: `status = 'queued'`, or `failed` with a `next_attempt_at` that has passed. Only **one** function calls the upload API, `HttpDeliveryApi.uploadDelivery` (`src/services/api.ts`), and only `sync/uploadDelivery.ts` calls it.

| Step | What happens | Code | Status / queue |
|---|---|---|---|
| 1 | User presses Save; form validated | `CaptureScreen.onSave` | — |
| 2 | Photo resized and copied into app storage | `useCreateDelivery` → `persistPhoto` | — |
| 3 | Row inserted into SQLite | `deliveryRepository.create` | `queued`, **enters the queue**; the card appears via `notify()` |
| 4 | Engine nudged; Save returns without waiting | `syncEngine.requestSync('created')` | — |
| 5 | Offline? The run stops quietly | `SyncEngine.runOnce` → `network.isOnline()` | stays `queued` ("Waiting for connection") |
| 6 | Network returns → NetInfo event → offline→online check | `netInfoMonitor.subscribe` → `SyncEngine.start` listener → `requestSync('reconnect')` | — |
| 7 | Read the due rows, oldest first | `processDueDeliveries` → `getDueDeliveries` | — |
| 8 | Atomic claim, committed **before** the request | `uploadDelivery` → `claimForUpload` | `uploading`, **leaves the queue** |
| 9 | `POST /deliveries` + `Idempotency-Key` (15 s timeout) | `HttpDeliveryApi.uploadDelivery` | — |
| 10a | Success (201 new / 200 replayed) | `markSynced` | `synced`, **out for good** |
| 10b | Error → retry decision | `markFailed` + `retryPolicy` | `failed`; rejoins the queue at `next_attempt_at`, or waits for Retry if that's NULL |
| 11 | The next retry time arrives | `scheduleNextRetry` → `requestSync('backoff-timer')` | due again → back to step 8 |
| — | App killed during step 9 | next launch: `SyncEngine.start` → `recoverInterrupted` | `uploading` → `queued`, **back in the queue**; re-sent with the same key |
| — | User taps Retry | `retryDelivery` → `resetForManualRetry` → `requestSync('manual')` | `failed` → `queued`, **back in the queue** |

Every status change calls `notify()`, and `useDeliveries` re-reads SQLite, so the card on screen updates at each step.

## Triggers (`SyncReason`)
| Reason | Fired by |
|---|---|
| `startup` | `SyncEngine.start()`, after recovery |
| `foreground` | `AppState` → `active` |
| `reconnect` | NetInfo transition offline → online (not on every event) |
| `queue-focus` | Queue screen gains focus |
| `created` | A delivery was saved |
| `backoff-timer` | One `setTimeout` for the earliest future `next_attempt_at` |
| `manual` | Retry button (`retryDelivery`) |

## One run
1. **Single-flight:** if a run is active, set a follow-up flag and return the same promise. The flag is checked and cleared in the loop's own `finally`, so no request can be lost.
2. **Offline:** skip. No error, no timer. Reconnect will trigger a run.
3. `getDueDeliveries(now)`: queued rows, plus failed rows whose `next_attempt_at <= now`, oldest first.
4. **For each row, one at a time.** Stop if the connection drops.
   - **Claim:** a conditional `UPDATE` to `uploading`. Skip unless `changes === 1`.
   - **Upload** through `DeliveryApi.uploadDelivery` (with dev headers in `__DEV__`).
   - **On success:** `markSynced(remoteId, replayed)`.
   - **On failure:** `retry_count + 1`, then `markFailed` with `next_attempt_at = now + delay`, or NULL if the delivery shouldn't retry automatically.
5. Schedule the backoff timer. Storage errors are logged and never crash the engine.

## Retry policy (`retryPolicy.ts`)
- `MAX_AUTO_RETRIES = 5`. Delay after *n* failed attempts is `min(1000 · 2ⁿ, 60 s)`: 2, 4, 8, 16 s.
- The 5th failure, or any permanent error, sets `next_attempt_at = NULL`, and the delivery waits for Retry.

| Error (`src/utils/errors.ts`) | Cause | Card text | Auto retry |
|---|---|---|---|
| `NetworkError` | fetch rejected | Can't reach server | ✅ |
| `TimeoutError` | no response in 15 s (`UPLOAD_TIMEOUT_MS`) | Upload timed out | ✅ |
| `ServerError` | HTTP 5xx | Server error (503) | ✅ |
| `ClientError` 429 | rate limited | Rejected by server (429) | ✅ |
| `MalformedResponseError` | body not JSON / missing `remoteId`,`replayed` | Unexpected server response | ✅ |
| `ClientError` other 4xx | validation, 422 key misuse | Rejected by server (4xx): … | ❌ |
| `PhotoMissingError` | photo file gone | Photo missing on device | ❌ |
| `ConfigError` | `EXPO_PUBLIC_API_URL` unset | EXPO_PUBLIC_API_URL is not set … | ❌ |

## Recovery and duplicates
- **Recovery on launch:** `recoverInterrupted()` runs once, before anything else. See [ADR 0003](../architecture/decisions/0003-recover-uploading-on-launch.md).
- **Duplicate prevention:** the idempotency key, single-flight runs and the atomic claim. See [ADR 0002](../architecture/decisions/0002-idempotency-key-and-atomic-claim.md).

## Logs
In dev builds, every step logs `[sync] …` to the Metro console, e.g. `sync requested: reconnect`, `recovered 1 interrupted upload(s)`, `synced <id> (replayed)`, `failed <id>: Server error (503)`.
