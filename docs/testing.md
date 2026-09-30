# Testing

## Automated (42 tests)

```bash
npm run typecheck && npm run lint && npm test && npm run test:server
```

| Suite | Runner | Tests | Covers |
|---|---|---|---|
| `__tests__/SyncEngine.test.ts` | Jest | 11 | Success; retryable failure → backoff; 5-attempt cap; permanent 4xx; exhausted rows not auto-picked; concurrent requests → one upload per row; recovery of `uploading` on start; offline → no upload; offline → online triggers sync; backoff timer; manual retry |
| `__tests__/retryPolicy.test.ts` | Jest | 12 | 2/4/8/16 s delays, 60 s cap, retryable vs permanent classification, cap cut-off |
| `__tests__/validation.test.ts` | Jest | 5 | Required fields, PO pattern, length limits |
| `__tests__/api.integration.test.ts` | Jest (node env) | 6 | The real `HttpDeliveryApi` against the real mock server: replay without duplicate, 503, malformed, timeout, missing photo, and kill-during-upload → recover → replay |
| `mock-server/server.test.js` | `node:test` | 8 | 201/200 replay, new key, 503 stores nothing, malformed stores, 422 key misuse, 400 validation, missing key |

Test helpers live in `test-support/`:
- `fakes.ts`: in-memory `DeliveryStore`, `FakeNetwork` and a fake API, with the same semantics as the SQL.
- `nodeFetch.ts`: the jest-expo preset replaces global `fetch` with Expo's native one, which can't reach the network under Jest, so the integration tests use this adapter.

**Not automated:**
- Repository SQL on a device (the native module)
- UI rendering and taps (no component or E2E tests)

## On-simulator verification

iOS Simulator (iPhone 17), Expo Go 57.0.9, 2026-09-30, `main` @ `96a748b`.

The app was driven by writing rows and settings straight into its SQLite database and force-quitting and relaunching Expo Go; there are no taps in this setup. Results were read from the database, the mock-server log and screenshots.

| Scenario | Result |
|---|---|
| Online save → sync | ✅ Queued → Synced about 8 s after launch |
| Server errors → auto retries → recovery | ✅ Card "Failed · Retrying in 3s" + Retry now; the backoff timer retried on its own; synced with no tap once errors were off |
| **Kill during upload** (8 s delay, force-quit while Uploading…) | ✅ Relaunch logged `recovered 1 interrupted upload(s)`; the server logged `NEW` then `REPLAY` with the same remoteId; the row is synced with `remote_replayed = 1`; stored once on the server |
| Timeout | ✅ "Upload timed out", then an auto retry synced as a replay |
| Malformed response | ✅ "Unexpected server response", then an auto retry synced as a replay |
| Server down | ✅ "Can't reach server"; synced by backoff after the server restarted |
| Photo file missing | ✅ "Photo missing on device"; no auto retry |
| 5 failed attempts | ✅ "Upload failed — still saved on this device" + Retry; a relaunch doesn't retry it |
| Duplicate submission (curl) | ✅ Same remoteId, `replayed: true`, server count +1 only |
| Restart keeps records | ✅ Every relaunch kept all rows |

**Still to verify by hand on a phone** (steps in the root [README §6](../README.md#6-testing-the-scenarios)):
- camera and library capture
- airplane mode offline → online
- the Retry button tap
- dev-screen buttons, including Reset demo data
