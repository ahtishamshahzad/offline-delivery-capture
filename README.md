# Delivery Capture — offline-first field prototype

A construction foreman receives a material delivery with no signal. They photograph the delivery ticket, enter the supplier, PO number and a note, and save. The record is stored on the device immediately and is uploaded automatically when connectivity returns, without duplicates, even if the app is killed mid-upload.

**Stack:** Expo SDK 57 · React Native 0.86 · TypeScript (strict) · Expo Router · `expo-sqlite` · `@react-native-community/netinfo` · `expo-image-picker` + `expo-image-manipulator` · `expo-file-system` · zero-dependency Node mock API.

---

## 1. Architecture

```text
 ┌──────────────────── UI (screens + components) ─────────────────────┐
 │  Queue  ·  Capture  ·  Delivery details  ·  Dev settings           │
 └──────────────────────────────┬──────────────────────▲──────────────┘
                   hooks only   │                      │ re-render on change
 ┌──────────────────────────────▼──────────────────────┴──────────────┐
 │ hooks: useCreateDelivery · useDeliveries · useSyncQueue · …        │
 └───────────┬───────────────────────────────┬────────────────────────┘
             ▼                               ▼
 ┌──── deliveryRepository ────┐      ┌──── SyncEngine ─────────────────┐
 │ typed, parameterized SQL   │◄─────┤ single-flight · atomic claim ·  │
 │ emits change events        │      │ backoff · recovery · triggers   │
 └────────────┬───────────────┘      └──────────────┬──────────────────┘
              ▼                                     ▼
        SQLite (source of truth)           DeliveryApi (interface)
        deliveries · app_settings                   │
                                          HttpDeliveryApi ──► mock-server
                                                              (Idempotency-Key store)
```

- **The UI reads only from SQLite.** Screens subscribe to repository change events and re-query, so status changes made by the sync engine appear live. API responses are written to SQLite, never shown directly.
- **Screens contain no database or sync logic.** They use hooks; hooks call the repository, the photo service and the sync engine.
- **The sync engine depends on interfaces** (`DeliveryStore`, `DeliveryApi`, `NetworkMonitor`, clock) injected in `src/sync/index.ts`. Tests pass in-memory fakes; a real backend only needs a new `DeliveryApi`.

```text
src/
  app/            Expo Router routes (thin: bootstrap + re-export screens)
  screens/        QueueScreen, CaptureScreen, DeliveryDetailsScreen, DevSettingsScreen
  components/     StatusBadge, ConnectivityBanner, DeliveryCard, PhotoPicker, FormField, …
  hooks/          useAppBootstrap, useDeliveries, useCreateDelivery, useSyncQueue, …
  database/       database.ts (connection), schema.ts, migrations.ts (PRAGMA user_version)
  repositories/   deliveryRepository.ts, settingsRepository.ts
  sync/           SyncEngine.ts, syncQueue.ts, uploadDelivery.ts, retryPolicy.ts, index.ts
  services/       api.ts (DeliveryApi + HttpDeliveryApi), network.ts, photoService.ts
  types/ utils/   delivery/settings types, uuid, errors, validation, time
mock-server/      server.js (Node http, no deps) + server.test.js
__tests__/        sync engine, retry policy, validation, API ↔ server integration
```

## 2. Offline strategy

**Local persistence.** Pressing *Save*:

1. validates the form (photo, supplier and PO are required);
2. resizes the photo to 1280 px, compresses it to JPEG (quality 0.6) and copies it into the app's **document directory** (`photos/<id>.jpg`). Picker and cache URIs can disappear, so the database stores the path *relative* to the document directory;
3. inserts a `deliveries` row with `status = 'queued'`;
4. returns to the queue and asks the sync engine to run.

None of these steps needs a network. With no signal, the delivery simply shows **Queued · Waiting for connection**, with no error.

**Queue (outbox).** The `deliveries` table is the outbox. Rows move through:

```text
queued ──claim──► uploading ──success──► synced
   ▲                  │
   │                  └─failure─► failed (retrying in Ns)  ──timer──► claim again
   │                                  │ after 5 attempts / permanent error
   │                                  ▼
   └──────── Retry ─────────── failed (needs Retry)
```

| Column | Purpose |
|---|---|
| `id` | UUID v4 from `expo-crypto` |
| `idempotency_key` | `delivery-<id>`, generated once, `UNIQUE` |
| `status` | `queued` / `uploading` / `synced` / `failed` (CHECK constraint) |
| `retry_count`, `next_attempt_at`, `last_attempt_at`, `error_message` | Retry state, persisted so it survives restarts |
| `remote_id`, `remote_replayed` | Server id, and whether the server reported a replay |

**Connectivity detection.** NetInfo counts the device as online when `isConnected && isInternetReachable !== false`. The engine is triggered by:

- app start
- app returning to the foreground
- queue screen focus
- a new delivery being saved
- an **offline → online** transition
- the backoff timer
- the Retry button

It never relies on the network listener alone.

**Retry.** Failures are split into two kinds. Transient failures are retried automatically with exponential backoff: network error, timeout, 5xx, 429 and malformed responses. Permanent failures (other 4xx, photo missing) wait for the user.

| Attempt | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Delay | immediate | 2 s | 4 s | 8 s | 16 s |

After the 5th failed attempt the card shows **Upload failed — still saved on this device [Retry]**. A failed card always offers *Retry now*. Deliveries are never deleted.

**Sync states in the UI.** Each state has its own colour and copy: Queued (grey), Uploading… (blue + spinner), Synced ✓ (green), Failed (red, with a live countdown or a Retry button). A banner shows **● Online** or **● Offline**.

## 3. App-kill recovery

Before any request is sent, the engine **claims** the row in a single atomic statement and commits it:

```sql
UPDATE deliveries SET status = 'uploading', last_attempt_at = :now
WHERE id = :id
  AND (status = 'queued' OR (status = 'failed' AND next_attempt_at <= :now))
-- proceed only if changes === 1
```

If the process is killed during the upload, the row stays `uploading` in SQLite. On the next launch, **before the sync engine starts**, `recoverInterrupted()` runs:

```sql
UPDATE deliveries SET status = 'queued' WHERE status = 'uploading'
```

This is safe because only one JS process owns the database, so at cold start nothing can really be mid-upload. The delivery is then uploaded again with the **same idempotency key**. If the server had already stored it before the kill, it answers `replayed: true` with the original `remoteId`, and the details screen shows *Server replay: Yes — duplicate prevented*.

```text
Uploading… → app killed → relaunch → recover (uploading → queued) → upload (same key) → Synced ✓ (replayed)
```

Result writes are guarded too (`… WHERE id = ? AND status = 'uploading'`), so a late result can never overwrite a newer state. SQLite runs in WAL mode, so a crash leaves each row in its old or new state, never half-written.

## 4. Duplicate prevention

Three layers:

1. **Server idempotency.** Every upload sends `Idempotency-Key: delivery-<uuid>`. The key is created once, when the delivery is created, and never changes. The mock server stores `key → remoteId` **before** it responds. A repeated key returns `200 { remoteId: <same>, replayed: true }` and creates nothing. Reusing a key with a *different* payload is rejected with `422`.
2. **No concurrent uploads of the same row.** The engine is single-flight: requests that arrive during a run schedule exactly one follow-up run. The atomic claim (`changes === 1`) is a second guard.
3. **No double saves.** The capture form generates its delivery id once when it opens, the Save button locks while saving, and the insert is `ON CONFLICT(id) DO NOTHING`.

## 5. Running the app

Requirements: Node 18+ (tested with Node 24), and the **Expo Go** app (SDK 57) on a phone or simulator.

```bash
npm install

# 1. Start the mock API (prints the LAN URLs to use)
npm run server
#    → Mock delivery API listening on http://0.0.0.0:4000/deliveries
#    → Set EXPO_PUBLIC_API_URL to one of: http://192.168.1.20:4000

# 2. Point the app at it
cp .env.example .env
#    edit .env → EXPO_PUBLIC_API_URL=http://<your-laptop-LAN-IP>:4000
#    (iOS simulator: http://localhost:4000 · Android emulator: http://10.0.2.2:4000)

# 3. Start the app
npx expo start          # scan the QR code with Expo Go, or press i / a
```

Notes:
- The phone and the laptop must be on the same Wi-Fi network. If the phone can't reach the server, allow incoming connections for `node` in the macOS firewall.
- `.env` is gitignored. `EXPO_PUBLIC_*` values are bundled into the app, so they are public config, not secrets. The project has no secrets.
- The dev settings screen (⚙︎ on the queue screen, dev builds only) shows which API URL the app is using.

Quality checks:

```bash
npm run typecheck     # tsc --noEmit (strict)
npm run lint          # expo lint
npm test              # Jest: sync engine, retry policy, validation, API ↔ mock server
npm run test:server   # node:test: mock server idempotency and failure modes
```

## 6. Testing the scenarios

Use a **physical phone** for the airplane-mode steps. The iOS Simulator has no airplane mode and no camera; on a simulator, turn off the Mac's Wi-Fi instead and use *Choose Photo*. Keep the `npm run server` terminal visible: every request is logged as `NEW`, `REPLAY`, `FAIL` or `REJECT`.

The ⚙︎ **dev settings** screen has:
- **Simulate upload failure:** Off / Server error (503) / Malformed / Timeout
- **Upload delay:** 0 / 2 / 8 s
- **Re-send last synced delivery**
- the server's delivery count

| Scenario | Steps | Expected |
|---|---|---|
| **1. Online** | New Delivery → photo, "ABC Materials", "PO-1024", "20 bags of cement" → Save | Queued → Uploading… → **Synced ✓**. Server logs `NEW`. |
| **2. Offline capture** | Airplane mode ON → create a delivery → swipe-kill the app → reopen | Banner **● Offline**; the card still shows **Queued · Waiting for connection**, with its photo. |
| **3. Reconnect** | Airplane mode OFF | Banner turns **● Online**; the card goes Uploading… → **Synced ✓** with no tap. |
| **4. Failure + retry** | ⚙︎ → Failure = *Server error* → create a delivery | **Failed · Retrying in 2s**, then 4 s, 8 s, 16 s, then **[Retry]**. Set Failure = *Off* → tap **Retry** → Synced ✓. |
| **5. Kill during upload** | ⚙︎ → Delay = *8 s* → create a delivery → while it shows **Uploading…**, swipe-kill the app → reopen | The row is recovered to Queued → Uploading… → **Synced ✓**. Details show *Server replay: Yes*. Server logs `NEW` then `REPLAY` with the same id; the count increases by only 1. |
| **6. Duplicate submission** | ⚙︎ → **Re-send last synced delivery** | `replayed: true`, the same remoteId, "✓ Same delivery — no duplicate created"; the server count is unchanged. |
| Timeout | ⚙︎ → Failure = *Timeout* → create | About 15 s later: **Failed · Upload timed out**, retrying. Failure *Off* → Retry → Synced with replay (the server had already stored it). |
| Malformed response | ⚙︎ → Failure = *Malformed* → create | **Failed · Unexpected server response**, retrying. |
| Server down | Stop `npm run server` → create | **Failed · Can't reach server**, retrying. Restart the server → Retry → Synced. |
| Camera denied | Deny camera permission | A dialog offers *Open Settings*; *Choose Photo* still works. |

Duplicate check from the command line:

```bash
BODY='{"localId":"x","supplierName":"ABC","poNumber":"PO-1","note":"","createdAt":0,"photo":{"mimeType":"image/jpeg","base64":"AA=="}}'
curl -s -X POST localhost:4000/deliveries -H 'Content-Type: application/json' -H 'Idempotency-Key: delivery-demo' -d "$BODY"
# {"remoteId":"srv_…","replayed":false}
curl -s -X POST localhost:4000/deliveries -H 'Content-Type: application/json' -H 'Idempotency-Key: delivery-demo' -d "$BODY"
# {"remoteId":"srv_… (same)","replayed":true}
curl -s localhost:4000/deliveries | head -c 20   # {"count":1,…
curl -s -X DELETE localhost:4000/deliveries        # reset
```

**What the automated tests cover (42 tests: 34 Jest + 8 `node:test`):**
- **Sync engine, with fakes:**
  - success, backoff scheduling, the 5-attempt cap, permanent errors
  - concurrent sync requests (each delivery uploaded once)
  - kill recovery
  - offline gating and offline → online sync
  - the backoff timer and manual retry
- **Retry policy and form validation.**
- **Real HTTP client against the real mock server:**
  - replay without a duplicate
  - 503, malformed response, timeout and missing photo
  - the full "killed mid-upload → recover → replay" path
- **Mock server:** idempotency, 422 key misuse, 400 validation, simulated failures.

## 7. Trade-offs and what I'd do for production

| Prototype choice | Production version |
|---|---|
| Photo sent as base64 inside JSON | Multipart or a presigned object-storage URL, with resumable uploads for large files |
| Sync only while the app is running (start, foreground, reconnect, timers) | Also `expo-background-task` so the queue drains while the app is closed |
| Mock server with a JSON-file store and no auth | Real API: DB unique constraint on (user, idempotency key), key expiry, authentication and per-user key scope, TLS |
| Hand-written response type guards | A schema library (e.g. zod) shared between client and server |
| Sequential uploads, pure exponential backoff | Limited parallel uploads, backoff jitter, telling "server unreachable" apart from "offline" |
| Repository SQL is covered by manual device runs; engine logic by Jest with fakes | On-device integration tests for the SQLite layer and Maestro E2E flows for the scenarios above |
| Photos of synced deliveries are kept forever | A retention/cleanup policy; encryption at rest if tickets contain sensitive data |
| Create-only records | Editing and conflict resolution if deliveries become editable after sync |
| No crash or error reporting | Structured logs and crash reporting (e.g. Sentry) |
| Android can kill the app while the camera is open | Recover the photo with `ImagePicker.getPendingResultAsync()` |

Deliberately **not** used: TanStack Query (all UI data is local, so SQLite plus change events is enough), Redux/Zustand (no global state), AsyncStorage (SQLite holds settings too), axios, and an ORM (one table).

## Demo script (≈90 s)

Before recording: ⚙︎ → **Reset demo data**. This clears local deliveries and photos, turns the simulations off and empties the mock server, so the queue starts empty.

1. **0:00** Queue, **● Online** → New Delivery → take a photo of the ticket → "ABC Materials" / "PO-1024" / "20 bags of cement" → Save → Queued → Uploading… → **Synced ✓**.
2. **0:20** Airplane mode ON → **● Offline** → create "XYZ Supplies" / "PO-2048" → **Queued · Waiting for connection** → swipe-kill → reopen → still there.
3. **0:45** Airplane mode OFF → **Queued → Uploading… → Synced ✓** with no tap.
4. **1:10** ⚙︎ Failure = Server error → create → **Failed · Retrying in 2s** → Failure Off → **Retry now** → Synced ✓. Or: ⚙︎ **Re-send last synced** → `replayed: true`, same id, count unchanged.

> "The local SQLite database is the source of truth for the UI. Deliveries are persisted locally first and placed into an outbox-style queue. The sync engine processes queued records when connectivity is available. Each delivery has an idempotency key, so retries after an interrupted upload don't create duplicates. On app startup, records stuck in uploading are recovered and retried."
