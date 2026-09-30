# Offline-First Delivery Capture — Project Plan

> Status: ✅ **FINAL — approved 2026-09-30. Implementation not started; begins at Phase 0.**
> Target: **Expo SDK 57**, TypeScript strict, Node ≥ 18 (machine: v24.10.0).
> Time budget: 4–6 h coding test. Estimate: **~5 h 30 m** (Phase 4 in parallel), **6 h 10 m** worst case.

---

## 0. Request classification

| Item | Value |
|---|---|
| Type | New project (greenfield). Single mobile app plus a tiny mock backend. |
| Codebase | None. `offline_app/` contains only this plan and is not a git repo yet. |
| Sensitive data | None. No auth, no payments, no PII beyond a supplier name. |
| Success = | All 6 scenarios work on a real device, and a 1–2 min demo can be recorded. |

---

## 1. Requirements baseline

### 1.1 Confirmed (from the brief)
- Capture a ticket photo (camera **or** library), plus supplier name, PO number, and note.
- Save works fully offline. SQLite is the **source of truth** for the UI.
- A queue screen shows the persisted records with 4 statuses: `queued`, `uploading`, `synced`, `failed`.
- Auto-sync when: the app starts, the queue screen opens, a delivery is created while online, and the network goes offline → online.
- Exponential backoff (immediate, 2 s, 4 s, 8 s…) with a cap. `retryCount`, `lastAttemptAt` and `errorMessage` are persisted. Failed items get a manual Retry button.
- App killed during upload → the next launch resets `uploading` rows to `queued` and re-syncs.
- Idempotency key `delivery-<uuid>` is generated once at creation and sent as the `Idempotency-Key` header. The server deduplicates on it.
- The `DeliveryApi` interface decouples the sync engine from HTTP.
- Mock backend with failure simulation and upload delay.
- The photo is copied into persistent app storage (never a temp URI) and compressed.
- TypeScript strict mode, no DB or sync logic in screens, no AsyncStorage as the database, no Redux.
- README covering architecture, offline strategy, recovery, idempotency, run commands, test steps, and trade-offs.

### 1.2 Decisions (approved)
| # | Decision | Why |
|---|---|---|
| D1 | **Expo Go is enough.** No dev build needed. | Every package in §3.1 ships in Expo Go SDK 57. Faster to run. |
| D2 | The mock backend is a **zero-dependency Node HTTP server** (`mock-server/server.js`) that persists its data to a JSON file. | Real HTTP means airplane mode genuinely blocks uploads. Idempotency survives an app kill and a server restart. |
| D3 | The photo is sent as **base64 inside a JSON body**, not multipart. | No multipart parser needed. Photos are about 200 KB after compression. Listed as a trade-off. |
| D4 | **TanStack Query is not used.** | All UI data is local. A repository change event plus hooks covers reactivity. The brief allows this: "only where it provides value". |
| D5 | There are 4 statuses only. "Failed · retrying in Ns" and "Failed · needs retry" are told apart by `nextAttemptAt` (set vs null). | Keeps the status enum exactly as specified. |
| D6 | UUIDs come from `expo-crypto` `randomUUID()`. | No extra `uuid` package. |
| D7 | Dev settings (failure mode, upload delay) live in the SQLite `app_settings` table and are sent as request headers. | The server stays stateless and the settings survive restarts. |
| D8 | Git: local repo, `main`, one commit per phase. **No remote or push unless explicitly asked.** | "Git repository is clean and runnable". |
| D9 | Package manager: **npm**. Primary test device: **a physical phone on the same Wi-Fi as the laptop.** | A real airplane-mode demo. The iOS Simulator has no camera and no airplane mode. |

### 1.3 Open questions
None. All defaults were accepted.

---

## 2. Applications

| Application | Needed? | Justification |
|---|---|---|
| Mobile app (Expo RN) | ✅ | The core deliverable. |
| Mock backend (Node) | ✅ minimal | Shows real HTTP, idempotency and failure injection. |
| Web / admin / marketing | ❌ | Out of scope. |
| Worker / realtime / cloud storage | ❌ | Out of scope. The mock server writes photos to local disk. |

---

## 3. Stack

| Area | Choice | Alternative considered |
|---|---|---|
| Framework | Expo **SDK 57** + React Native + TypeScript (strict) | RN CLI: slower setup, no benefit here |
| Navigation | Expo Router (file-based). Route files are thin wrappers around `src/screens/*`. | React Navigation: equivalent, more boilerplate |
| Local DB | `expo-sqlite` (async API) + hand-written SQL + `PRAGMA user_version` migrations | Drizzle ORM: extra dependency for one table |
| Files | `expo-file-system` `File` / `Directory` / `Paths` API → `Paths.document/photos/` | legacy `expo-file-system/legacy` API |
| Photo | `expo-image-picker` (camera + library, `quality: 1`) → `expo-image-manipulator` (the single place that resizes and compresses: 1280 px wide, JPEG 0.6) | `expo-camera`: more UI to build |
| Network | `@react-native-community/netinfo` | — |
| IDs | `expo-crypto` `randomUUID()` | `uuid` + a polyfill |
| State | React state for forms only. The queue always comes from SQLite. | Zustand/Redux: not needed |
| Server state | none (see D4) | TanStack Query |
| Mock backend | Node built-in `http`, JSON-file store | Express, json-server |
| Tests | Jest (`jest-expo`) for pure logic and the sync engine with fakes. `node:test` for the mock server. | Maestro E2E: skipped for time |
| Lint/format | ESLint (`eslint-config-expo`) + Prettier + `tsc --noEmit` | — |

### 3.1 Complete dependency manifest (checked against npm on 2026-09-30)

Exact patch versions are **locked by `npx expo install`** so they match SDK 57. The versions below are the npm `latest` versions on the check date, recorded for reference.

**A. Added by us (runtime):**
| Package | Version | Used in | Purpose |
|---|---|---|---|
| `expo-sqlite` | 57.0.x | `database/` | Local DB, source of truth |
| `expo-file-system` | 57.0.x | `photoService`, `api` | Persist the photo, read base64 |
| `expo-image-picker` | 57.0.x | `photoService` | Camera + library, camera permission |
| `expo-image-manipulator` | 57.0.x | `photoService` | Resize to 1280 px, JPEG 0.6 |
| `expo-crypto` | 57.0.x | `utils/uuid` | `randomUUID()` |
| `@react-native-community/netinfo` | 12.0.x | `services/network` | Connectivity |

**B. Installed by the `create-expo-app` default template (kept):**
`expo` 57.0.x, `expo-router` 57.0.x, `react`, `react-native`, `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`, `expo-status-bar`, `@expo/vector-icons` (status and gear icons), `typescript`, `@types/react`.
Template demo code and packages that nothing imports (for example `expo-haptics`, `expo-blur`, reanimated demo components) are removed in task 0.1.

**C. Dev only (added by us):**
| Package | Purpose |
|---|---|
| `jest-expo` 57.0.x + `jest` + `@types/jest` | Unit tests (Phase 7) |
| `eslint` + `eslint-config-expo` | Lint (set up by `npx expo lint`) |
| `prettier` | Formatting |

**D. Built into React Native, Expo Router or Node (no install):**
`AppState`, `Linking`, `FlatList`, `ActivityIndicator`, `KeyboardAvoidingView` (RN) · `useFocusEffect`, `router` (expo-router) · `fetch`, `AbortController` (RN runtime) · `node:http`, `node:fs`, `node:crypto` (payload hash), `node:test` (mock server).

**Explicitly NOT used (and why):** TanStack Query (D4) · Redux/Zustand (no global state) · AsyncStorage (SQLite holds settings too) · axios (fetch is enough) · uuid (expo-crypto) · Drizzle/ORM (one table) · expo-camera (the picker camera is enough) · expo-secure-store (no secrets or tokens exist) · Express (Node `http` is enough) · zod (type guards; see trade-offs) · Maestro (time box).

**Rule:** a new package during implementation needs a row in this table and a reason. Otherwise it doesn't go in.

### 3.2 Verified SDK 57 API patterns (docs.expo.dev, checked 2026-09-30)

| Need | API to use |
|---|---|
| Open DB | `const db = await SQLite.openDatabaseAsync('deliveries.db')` |
| Bulk DDL / PRAGMA | `db.execAsync(sql)`. **Unescaped: DDL constants only, never user input.** |
| Parameterized write | `const { changes } = await db.runAsync(sql, ...params)`. `changes` is used for the atomic claim. |
| Reads | `db.getAllAsync<Row>(sql, ...params)`, `db.getFirstAsync<Row>(sql, ...params)` |
| Transaction | `db.withTransactionAsync(async () => { … })` (migrations) |
| Camera | `ImagePicker.requestCameraPermissionsAsync()` → `ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })` |
| Library | `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })`. **No permission request needed** for picking images. |
| Result | `if (result.canceled) …; const uri = result.assets[0].uri` |
| Resize + compress | `const ref = await ImageManipulator.manipulate(uri).resize({ width: 1280, height: null }).renderAsync(); const out = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG })`. The result lands in the **cache** directory. |
| Persist | `new File(out.uri).copy(new File(Paths.document, 'photos', `${id}.jpg`))`, after `new Directory(Paths.document, 'photos').create({ idempotent: true })` |
| Resolve / exists | `new File(Paths.document, relPath)` → `.uri`, `.exists` |
| Base64 for upload | `await file.base64()`, with `file.base64Sync()` as a fallback (the sync form is confirmed in the docs) |
| Delete orphan | `file.delete()` |

---

## 4. Architecture

### 4.1 Layers

```text
 ┌────────────── UI (screens / components) ──────────────────────┐
 │  CaptureScreen  QueueScreen  DeliveryDetailsScreen  DevScreen │
 └───────────────┬───────────────────────────────▲───────────────┘
                 ▼  hooks only                   │ re-render
 ┌──── hooks: useCreateDelivery · useDeliveries · useDelivery ───┐
 │            useSyncQueue · useNetworkStatus · useDevSettings   │
 └───────┬──────────────────────────────┬────────▲───────────────┘
 commands│ create / retry / syncNow     │        │ change events
         ▼                              ▼        │
 ┌─ deliveryRepository (typed SQL) ─┐  SyncEngine (singleton)
 │ create · listAll · getById ·     │  triggers: start · foreground ·
 │ getDueDeliveries · claimForUpload│  queue focus · after create ·
 │ markSynced · markFailed ·        │◄─ offline→online · backoff timer ·
 │ recoverInterrupted ·             │  manual retry
 │ resetForManualRetry · subscribe  │  single-flight → claim → upload → mark
 └───────────────┬──────────────────┘          │
                 ▼                             ▼
     SQLite (deliveries, app_settings)   DeliveryApi (interface)
                                               │
                                     HttpDeliveryApi ──► mock-server (Node)
                                                         Idempotency-Key store
```

**Rule:** screens import **only hooks and components**. Hooks are the only callers of the repositories, `photoService` and `syncEngine`.

### 4.2 Data model

```sql
-- migration 1
CREATE TABLE deliveries (
  id               TEXT PRIMARY KEY NOT NULL,          -- uuid v4
  supplier_name    TEXT NOT NULL,
  po_number        TEXT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  photo_path       TEXT NOT NULL,                       -- RELATIVE to Paths.document: 'photos/<id>.jpg'
  status           TEXT NOT NULL CHECK (status IN ('queued','uploading','synced','failed')),
  retry_count      INTEGER NOT NULL DEFAULT 0,          -- failed attempts since last manual reset
  next_attempt_at  INTEGER,                             -- epoch ms; null = no auto retry scheduled
  last_attempt_at  INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  remote_id        TEXT,
  remote_replayed  INTEGER NOT NULL DEFAULT 0,          -- 1 = server answered replayed:true
  idempotency_key  TEXT NOT NULL UNIQUE,                -- 'delivery-<id>'
  error_message    TEXT
);
CREATE INDEX idx_deliveries_status ON deliveries(status, next_attempt_at);

CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
-- keys: 'failureMode' = off|server_error|malformed|timeout ; 'uploadDelayMs' = 0|2000|8000
```

- The TypeScript model uses camelCase (`supplierName`…). One typed mapper converts rows to models.
- `photo_path` is stored **relative** to `Paths.document`. The absolute iOS container path can change between app updates.
- Timestamps are epoch ms integers. `PRAGMA journal_mode = WAL` is set on open.

### 4.3 Status state machine

```text
             create (offline or online)
                     │
                     ▼
   ┌──────────► queued ◄──────────── recoverInterrupted() on cold start
   │                 │  claimForUpload (atomic, see 4.4)
   │                 ▼
   │             uploading ──── success ────► synced (remote_id, remote_replayed; terminal)
   │                 │
   │   failure: retry_count += 1
   │                 ├── retryable AND retry_count < 5 ──► failed + next_attempt_at = now + backoff
   │                 │                                      "Failed · retrying in 4s"  [Retry now]
   │                 │                                      (timer fires → claim again)
   │                 └── non-retryable OR retry_count ≥ 5 ► failed + next_attempt_at = NULL
   │                                                        "Upload failed — saved locally" [Retry]
   └── manual Retry (any failed row): retry_count=0, next_attempt_at=NULL, status=queued
```

### 4.4 Sync engine design (`src/sync/SyncEngine.ts`)
- **Single-flight:** one `running: Promise | null`. A `requestSync()` during a run sets `rerunRequested = true`, and the loop runs once more afterwards. Triggers are never dropped and never run twice at once.
- **Atomic claim (the second layer):**
  `UPDATE deliveries SET status='uploading', last_attempt_at=?, updated_at=? WHERE id=? AND status IN ('queued','failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`. The engine proceeds only if `changes === 1`.
  A failed row with `next_attempt_at = NULL` is exhausted. It is **excluded** from `getDueDeliveries` and only comes back through manual Retry, which sets it to `queued`.
- **Guarded results:** `markSynced` and `markFailed` use `WHERE id=? AND status='uploading'`, so a stale result can never overwrite a newer state.
- **Loop:** `getDueDeliveries(now)` returns queued rows plus failed rows whose `next_attempt_at <= now`, ordered by `created_at`. They are processed **sequentially**.
- **Online gate:** the run is skipped when offline. Rows stay `queued` ("Waiting for connection") and no error is shown.
- **Backoff timer:** after each run, one `setTimeout` is set for the earliest future `next_attempt_at`. The previous one is cleared.
- **Recovery:** `recoverInterrupted()` runs **once at bootstrap, before the first sync**: `UPDATE deliveries SET status='queued', updated_at=? WHERE status='uploading'`. This is safe: one JS process owns the DB, so nothing can be mid-upload at cold start. The idempotency key makes the re-send safe.
- **Triggers:** bootstrap, `AppState` → 'active', queue screen focus, after create, NetInfo offline → online transition, backoff timer, manual retry.
- **Dependency injection:** `new SyncEngine({ repo, api, network, clock })`. The app wires the real ones in `src/sync/index.ts`; tests pass fakes.

### 4.5 Retry policy (`src/sync/retryPolicy.ts`, pure)
- `MAX_AUTO_RETRIES = 5`. `nextDelayMs(retryCount) = min(1000 * 2 ** retryCount, 60_000)`. After failures 1–4 that gives 2 s, 4 s, 8 s, 16 s. The 5th failure goes to manual.
  Attempt timeline: #1 immediate, #2 +2 s, #3 +4 s, #4 +8 s, #5 +16 s, then [Retry].
- `isRetryable(err)`: `NetworkError`, `TimeoutError`, `ServerError` (5xx), 429 and `MalformedResponseError` are retryable. `ClientError` (4xx) and `PhotoMissingError` are permanent.

### 4.6 API contract

```text
POST {EXPO_PUBLIC_API_URL}/deliveries
Headers: Content-Type: application/json
         Idempotency-Key: delivery-<uuid>
         X-Simulate-Failure: server_error | malformed | timeout   (dev, optional)
         X-Simulate-Delay-Ms: 2000 | 8000                         (dev, optional)
Body:    { localId, supplierName, poNumber, note, createdAt, photo: { mimeType: 'image/jpeg', base64 } }

201 { remoteId, replayed: false }   first time this key is seen
200 { remoteId, replayed: true }    key already stored → no new record
400 { error }                       invalid body
422 { error }                       same key, different payload (key misuse)
503 { error }                       simulated server error
```

- `HttpDeliveryApi` uses `fetch` with an `AbortController` **15 s timeout**. It maps statuses to typed errors and checks the response with a type guard (`isUploadResponse`). A bad shape becomes `MalformedResponseError`.
- Errors (`src/utils/errors.ts`): `NetworkError`, `TimeoutError`, `ServerError(status)`, `ClientError(status)`, `MalformedResponseError`, `PhotoMissingError`, plus `toUserMessage(err)`.

### 4.7 Mock server (`mock-server/server.js`)
- Node `http` on `0.0.0.0:4000`. Stores `idempotencyKey → { remoteId, receivedAt, payloadHash, supplierName, poNumber }` in `mock-server/data/db.json`, and photos in `mock-server/data/photos/<remoteId>.jpg`.
- Request order: validate → apply the delay → handle simulation → store or replay → respond.
  - `server_error`: respond 503. **Nothing is stored.**
  - `malformed`: store (or replay), then respond 200 with a broken body `{"ok":` so the client sees `MalformedResponseError`.
  - `timeout`: store (or replay), then wait 20 s, longer than the 15 s client timeout.
  - no header: store → 201, or replay → 200.
- The key is **stored before the response is sent**. That reproduces "the server got it but the client died or timed out". When the retry comes after the toggle is off or the app restarts, it returns `replayed: true`.
- `GET /deliveries` → `{ count, deliveries }`. `DELETE /deliveries` resets the store. Every POST logs `NEW <key> → <remoteId>` or `REPLAY <key> → <remoteId>`.
- It is a dev-only tool with no auth. Documented as such.

### 4.8 Repository layout

```text
offline_app/
  app/                          # Expo Router (thin re-exports only)
    _layout.tsx                 # bootstrap: DB → recover → engine.start → <Stack>
    index.tsx                   # → QueueScreen (home)
    capture.tsx                 # → CaptureScreen
    delivery/[id].tsx           # → DeliveryDetailsScreen
    dev.tsx                     # → DevSettingsScreen (__DEV__ only)
  src/
    components/                 # StatusBadge, ConnectivityBanner, DeliveryCard, PhotoPicker,
                                # FormField, PrimaryButton, EmptyState
    screens/                    # CaptureScreen, QueueScreen, DeliveryDetailsScreen, DevSettingsScreen
    database/   database.ts  schema.ts  migrations.ts
    repositories/ deliveryRepository.ts  settingsRepository.ts
    sync/       SyncEngine.ts  syncQueue.ts  uploadDelivery.ts  retryPolicy.ts  index.ts (wired singleton)
    services/   api.ts (DeliveryApi + HttpDeliveryApi)  network.ts  photoService.ts
    types/      delivery.ts
    utils/      uuid.ts  errors.ts  time.ts  validation.ts
    hooks/      useCreateDelivery.ts  useDeliveries.ts  useDelivery.ts  useSyncQueue.ts
                useNetworkStatus.ts  useDevSettings.ts
    theme.ts    config.ts (EXPO_PUBLIC_API_URL)
  mock-server/  server.js  server.test.js  data/ (gitignored)
  __tests__/    retryPolicy.test.ts  SyncEngine.test.ts  validation.test.ts
  .env.example  .gitignore  README.md  PLAN.md  app.json  tsconfig.json  package.json
```

### 4.9 Reactivity (the UI reads SQLite)
The repository keeps a small listener set and calls `notify()` after every write. `useDeliveries()` and `useDelivery(id)` re-query SQLite on notify. Changes made by the sync engine appear live, and SQLite stays the only source of truth. (`addDatabaseChangeListener` was considered. The explicit emitter is easier to explain and to test.)

---

## 5. Phases & tasks

Legend: ⏱ estimate · ✅ acceptance criteria · 🔗 depends on

### Phase 0 — Project setup (⏱ 20 m)
| ID | Task | ✅ Acceptance |
|---|---|---|
| 0.1 | `npx create-expo-app@latest . --template default` (SDK 57, TS, Expo Router). Remove demo screens and unused demo packages. | Boots to a blank Stack in Expo Go on the phone. |
| 0.2 | tsconfig: `"strict": true`, `@/*` → `src/*` alias. | `npx tsc --noEmit` passes. |
| 0.3 | `npx expo install expo-sqlite expo-file-system expo-image-picker expo-image-manipulator expo-crypto @react-native-community/netinfo`; `npx expo install jest-expo jest @types/jest -- --save-dev`; `npm i -D prettier`; `npx expo lint`. | `npx expo-doctor` is clean. |
| 0.4 | `app.json`: `expo-image-picker` plugin with `cameraPermission` text; app name "Delivery Capture". | The iOS camera prompt shows the custom text. |
| 0.5 | `git init -b main`. `.gitignore` (node_modules, .expo, dist, `mock-server/data/`, `.env*` except `.env.example`). `.env.example`: `EXPO_PUBLIC_API_URL=http://192.168.x.x:4000`. `src/config.ts` reads it and fails loudly if it is missing. | First commit `chore: scaffold expo app`. |
| 0.6 | npm scripts: `start`, `server` (`node mock-server/server.js`), `typecheck`, `lint`, `test`, `test:server` (`node --test mock-server`). | Every script runs. |
| 0.7 | ✅ **Done in planning:** SDK 57 API patterns verified (§3.2). | — |

### Phase 1 — Persistence core (⏱ 50 m) 🔗0 — *Priority 1*
| ID | Task | ✅ Acceptance |
|---|---|---|
| 1.1 | `types/delivery.ts`: `SyncStatus`, `Delivery`, `DeliveryRow`, `NewDeliveryInput`, `rowToDelivery()`. | No `any`. |
| 1.2 | `database/schema.ts` (DDL constants) + `migrations.ts` (array; `PRAGMA user_version` read/set inside `withTransactionAsync`). | Reopening the DB does not re-run a migration. |
| 1.3 | `database/database.ts`: `getDb()` memoized promise → open, WAL, migrate. | One connection is reused. |
| 1.4 | `utils/uuid.ts` (`newId()`, `idempotencyKeyFor(id)`), `utils/time.ts` (`now()`, `formatRelative()`). | Key = `delivery-<uuid>`. |
| 1.5 | `repositories/deliveryRepository.ts`: `create` (`INSERT … ON CONFLICT(id) DO NOTHING`), `listAll`, `getById`, `getDueDeliveries(now)`, `claimForUpload(id, now)`, `markSynced(id, remoteId, replayed)`, `markFailed(id, msg, nextAttemptAt)`, `recoverInterrupted()`, `resetForManualRetry(id)`, `subscribe(listener)`. | Typed and parameterized (`runAsync`/`getAllAsync` only). Each write calls `notify()`. |
| 1.6 | `repositories/settingsRepository.ts`: typed `getDevSettings()` / `setDevSetting()` for `failureMode` and `uploadDelayMs`. | Survives a restart. |
| 1.7 | Temporary debug button: insert a row, kill the app, reopen, the row is still listed. Remove the button. | **SQLite persistence proven.** Commit `feat(db): sqlite schema, migrations, repository`. |

### Phase 2 — Capture flow (⏱ 50 m) 🔗1 — *Priority 2*
| ID | Task | ✅ Acceptance |
|---|---|---|
| 2.1 | `services/photoService.ts`: `takePhoto()` (camera permission → launch) and `pickPhoto()` (no permission). Both return `{ok:true, tempUri} \| {ok:false, reason:'denied'\|'cancelled'\|'unavailable'}`. | Denied → message + "Open Settings" (`Linking.openSettings()`). No camera (simulator) → "unavailable" message pointing to Choose Photo. |
| 2.2 | `photoService.persistPhoto(tempUri, id)`: manipulate → save to cache → copy to `Paths.document/photos/<id>.jpg` → return `photos/<id>.jpg`. Also `resolvePhotoUri(rel)`, `photoExists(rel)`, `deletePhoto(rel)`. | The file survives an app kill. A missing file renders a placeholder. |
| 2.3 | Components: `FormField`, `PhotoPicker` (preview + Take / Choose), `PrimaryButton` (loading/disabled). | Each ≤ ~80 lines. |
| 2.4 | `utils/validation.ts` → `validateDelivery(input)`: photo required; supplier required, trimmed, ≤ 100; PO required, ≤ 40, `^[A-Za-z0-9\-_/ ]+$`; note optional, ≤ 500. Returns a field → message map. | Pure and unit-tested (7.3). |
| 2.5 | `hooks/useCreateDelivery`: `persistPhoto` → `repository.create({ id: draftId, status:'queued', … })` → `syncEngine.requestSync('created')`. If the insert fails, `deletePhoto` removes the file and the error is surfaced. | No orphan photos. The error is shown and the form keeps its values. |
| 2.6 | `CaptureScreen`: `draftId` from `useState(() => newId())` (once per mount). Inline errors. Save disabled while saving. On success → `router.replace('/')`. | **A double-tapped Save creates exactly one row** (disabled button + stable id + `ON CONFLICT DO NOTHING`). |
| 2.7 | Airplane-mode check: saving works and there is no network error. | Commit `feat(capture): offline delivery capture`. |

### Phase 3 — Queue, details & status UI (⏱ 50 m) 🔗1
| ID | Task | ✅ Acceptance |
|---|---|---|
| 3.1 | `useDeliveries`, `useDelivery(id)`: subscribe → re-query. `useSyncQueue`: `{ pendingCount, failedCount, retry(id), syncNow() }`. | Updates live. No screen imports `sync/`, `repositories/` or `database/`. |
| 3.2 | `services/network.ts` + `useNetworkStatus`: online = `isConnected === true && isInternetReachable !== false`. | Airplane toggle flips it in about 1 s. |
| 3.3 | `ConnectivityBanner`: "● Online" (green) / "● Offline — deliveries will sync when connection returns" (amber). | Always visible on the queue screen. |
| 3.4 | `StatusBadge`: **Queued** (grey; "Waiting for connection" offline / "Waiting to upload" online) · **Uploading…** (blue + spinner) · **Synced ✓** (green) · **Failed** (red; "Retrying in Ns" with a 1 s countdown + [Retry now], or "Upload failed — saved locally" + [Retry]). | All 4 states are distinct in a screenshot. Retry is available on **every** failed row. |
| 3.5 | `DeliveryCard` (thumbnail, supplier, PO, `#<first 6 of id>`, relative time, badge) + `QueueScreen` (FlatList newest first, `EmptyState`, "+ New Delivery" button, header counts, gear → dev screen in `__DEV__`). | Rows render from SQLite. |
| 3.6 | `DeliveryDetailsScreen`: full photo, fields, status, retry count, last attempt, error, idempotency key, remote id, "Server replay: yes/no" (`remote_replayed`), Retry when failed. | Supports the idempotency demo. |
| 3.7 | Queue `useFocusEffect` → `syncNow()`. | Commit `feat(queue): queue, details, status and connectivity UI`. |

### Phase 4 — API layer + mock backend (⏱ 40 m) 🔗1.1 (can run in parallel with 2–3)
| ID | Task | ✅ Acceptance |
|---|---|---|
| 4.1 | `utils/errors.ts`: the error classes + `toUserMessage` (§4.6). | — |
| 4.2 | `services/api.ts`: `interface DeliveryApi { uploadDelivery(d: Delivery, opts?: DevOptions): Promise<UploadResult> }`, `UploadResult = { remoteId: string; replayed: boolean }`. `HttpDeliveryApi`: missing photo → `PhotoMissingError`; base64; fetch with a 15 s abort; status → error mapping; `isUploadResponse` guard. | The engine depends only on the interface. |
| 4.3 | `mock-server/server.js` per §4.7. | `curl` with the same key twice → one record, then `replayed:true`. |
| 4.4 | `mock-server/server.test.js` (`node:test`, random port): 201 new; same key → 200 replayed with the same remoteId; new key → count 2; `server_error` → 503 with nothing stored; `malformed` → stored + broken body; same key with a different payload → 422; invalid body → 400. | `npm run test:server` is green. Commit `feat(api): delivery api + idempotent mock server`. |

### Phase 5 — Sync engine (⏱ 70 m) 🔗1,3,4 — *Priorities 4–7*
| ID | Task | ✅ Acceptance |
|---|---|---|
| 5.1 | `sync/retryPolicy.ts`: `MAX_AUTO_RETRIES`, `nextDelayMs`, `isRetryable` (§4.5). | Unit-tested (7.1). |
| 5.2 | `sync/uploadDelivery.ts`: claim (skip if `changes !== 1`) → `api.uploadDelivery` → `markSynced`. On error: `retry_count + 1`, then `markFailed(toUserMessage(err), retryable && count < MAX ? now + nextDelayMs(count) : null)`. **Never deletes a row.** | Every failure path leaves the row in SQLite with an error message. |
| 5.3 | `sync/syncQueue.ts`: `processDueDeliveries(deps, now)`, a sequential loop over `getDueDeliveries`. | — |
| 5.4 | `sync/SyncEngine.ts`: `start()`, `stop()`, `requestSync(reason)`, single-flight + rerun flag, online gate, backoff timer. `sync/index.ts` wires the singleton with real deps + dev settings. | Two fast `requestSync()` calls → one upload per row. |
| 5.5 | Triggers inside `start()`: NetInfo listener (**offline → online transition only**), `AppState` 'active'. | Airplane OFF → queued rows go uploading → synced with no tap. |
| 5.6 | `app/_layout.tsx` bootstrap: `getDb()` → `recoverInterrupted()` → `syncEngine.start()` → `requestSync('startup')` → render the Stack. Loading view while booting; error view with a message if the DB fails. | Cold start after a kill mid-upload shows the row re-queued, then synced. |
| 5.7 | Manual retry: `resetForManualRetry(id)` → `requestSync('manual')`. | Failed → Retry → synced. |
| 5.8 | Verify scenarios 1, 3, 4 and 5 on the phone. | Commit `feat(sync): sync engine with backoff, recovery, idempotency`. |

### Phase 6 — Dev tools (⏱ 20 m) 🔗5
| ID | Task | ✅ Acceptance |
|---|---|---|
| 6.1 | `useDevSettings` + `DevSettingsScreen` (`__DEV__` only): **Failure mode** Off / Server error / Malformed / Timeout and **Upload delay** 0 / 2 / 8 s, persisted in `app_settings` and sent as `X-Simulate-*` headers. Also shows the configured API URL. | Each mode gives its own error text on the card. |
| 6.2 | "Re-send last synced delivery": calls the API again with the same key and shows `replayed: true` + remoteId inline. | Scenario 6 can be shown on camera. |
| 6.3 | "Server deliveries: N" (via `GET /deliveries`) with a refresh button. | N does not change after a replay. Commit `feat(dev): failure/delay toggles and duplicate demo`. |

### Phase 7 — Automated tests (⏱ 30 m) 🔗5
| ID | Task | ✅ Acceptance |
|---|---|---|
| 7.1 | `retryPolicy.test.ts`: 2/4/8/16 s, 60 s cap, retryable vs permanent classification. | Pass. |
| 7.2 | `SyncEngine.test.ts` with an in-memory fake repo, fake API, fake network and fake clock: (a) success → synced; (b) retryable failure → failed + nextAttemptAt; (c) 5th failure → next null; (d) permanent error → next null immediately; (e) concurrent `requestSync` → a single upload per row; (f) `recoverInterrupted` → queued → synced; (g) offline → no API call; (h) offline → online → sync runs. | Pass. |
| 7.3 | `validation.test.ts`: the rules from 2.4. | Pass. |
| 7.4 | `npm run typecheck && npm run lint && npm test && npm run test:server` are all green. | Commit `test: sync engine, retry policy, validation`. |

> The repository SQL runs in the manual scenarios, not Jest, because `expo-sqlite` needs the native runtime. Listed as a trade-off.

### Phase 8 — README, polish & demo prep (⏱ 40 m) 🔗all
| ID | Task | ✅ Acceptance |
|---|---|---|
| 8.1 | README: 1 Architecture (diagram) · 2 Offline strategy · 3 App-kill recovery · 4 Duplicate prevention (client + server) · 5 Running (exact commands, LAN IP, `.env`, Android emulator `10.0.2.2`) · 6 Testing (steps for every scenario, `curl` duplicate example) · 7 Trade-offs · project structure map. | A reviewer can run it from the README alone. |
| 8.2 | Polish: spacing, safe areas, `KeyboardAvoidingView` on Capture, `accessibilityLabel` on buttons and badges, touch targets ≥ 44 pt. | — |
| 8.3 | Full manual run of the §6 scenarios on the phone. Tick the DoD (§8). | All pass. Anything that fails is written down honestly. |
| 8.4 | Rehearse the demo script (§7) from a clean install with a reset server store. | — |
| 8.5 | Hygiene: `git status` clean; no `.env`, data files or secrets. | Commit `docs: readme and demo guide`. |

### Time summary
| Phase | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|
| Est. | 20 m | 50 m | 50 m | 50 m | 40 m | 70 m | 20 m | 30 m | 40 m | **6 h 10 m** (≈ 5 h 30 m with 4 parallel to 2–3) |

**If time runs short, cut in this order:** 6.3 → 7.3 → 3.6 extras → 8.2 polish. **Never cut:** Phases 1, 2, 5, or README sections 3–4.

---

## 6. Test scenarios (manual, on the phone)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Online flow | `npm run server`; phone online → New Delivery → photo + fields → Save | Queued → Uploading → **Synced ✓**. Server log `NEW`. |
| 2 | Offline + restart | Airplane ON → create → force-quit → reopen | **Queued · Waiting for connection**, photo visible, no error. |
| 3 | Reconnect | Continue from 2 → Airplane OFF | Banner Online. Uploading → Synced, no tap. |
| 4 | Failure + retry | Dev: Failure mode = Server error → create | Failed · retrying in 2 s, 4 s… After 5 attempts: [Retry]. Set mode Off → Retry → Synced. |
| 5 | Kill during upload | Dev: delay 8 s → create → force-quit during **Uploading…** → reopen | Row recovered to Queued → Uploading → Synced. Server: `NEW` then `REPLAY` with the same remoteId. Details show "Server replay: yes". Count +1 only. |
| 6 | Duplicate | Dev: "Re-send last synced" (or `curl` twice with the same key) | `replayed: true`, same remoteId, count unchanged. |
| 6b | Double-tap Save | Tap Save rapidly | Exactly one row. |
| 7 | Timeout | Dev: Failure mode = Timeout → create | About 15 s later: Failed "Upload timed out", retrying. Mode Off → Retry → Synced with **replayed: yes**. |
| 8 | Malformed | Dev: Failure mode = Malformed → create | Failed "Unexpected server response", retrying. |
| 9 | Server down | Stop `npm run server` while online → create | Failed "Can't reach server", retrying with backoff. Start the server → Retry → Synced. |
| 10 | Permission denied | Deny camera | Message + Open Settings. Choose Photo still works. |

---

## 7. Demo script (1–2 min)

| Time | Action |
|---|---|
| 0:00–0:20 | Queue (empty, ● Online) → New Delivery → Take Photo → "ABC Materials", "PO-1024", "20 bags of cement" → Save → Queued → Uploading → **Synced ✓** |
| 0:20–0:45 | Airplane ON (● Offline) → create "XYZ Supplies / PO-2048" → **Queued · Waiting for connection** → swipe-kill → reopen → still queued |
| 0:45–1:10 | Airplane OFF → **Queued → Uploading → Synced ✓** with no tap |
| 1:10–1:30 | Dev: Failure mode = Server error → create → Failed · retrying → mode Off → **Retry now** → Synced. *Or* "Re-send last synced" → `replayed: true`, count unchanged. |
| close | The one-paragraph architecture summary from the brief. |

---

## 8. Security & quality requirements
- No secrets exist. `EXPO_PUBLIC_API_URL` is public config; `.env` is gitignored and `.env.example` is committed.
- All SQL that involves user data goes through parameterized `runAsync`/`getAllAsync`. `execAsync` is used only for constant DDL/PRAGMA.
- Input rules live in `validation.ts` on the client and are re-checked by the mock server (400).
- The dev screen and `X-Simulate-*` headers are only sent when `__DEV__` is true. The mock server is a dev-only tool.
- Photos stay in the app sandbox. No photo data or base64 is logged.
- Plain HTTP to the LAN mock is acceptable for a prototype. Production needs TLS (trade-offs).

### Definition of Done
- [ ] RN + TS app runs (strict, `tsc` clean)
- [ ] Photo capture + library selection
- [ ] Supplier / PO / Note with validation
- [ ] Delivery persists in SQLite
- [ ] Works fully offline
- [ ] Queue reads persisted records
- [ ] Queued / Uploading / Synced / Failed all visible
- [ ] Automatic retry with backoff
- [ ] Offline → online triggers sync
- [ ] Restart preserves queued records
- [ ] `uploading` rows recover after a kill
- [ ] Idempotency prevents duplicates (server) + double-tap guard (client)
- [ ] README complete
- [ ] No secrets committed
- [ ] Git clean and runnable from the README

---

## 9. Git workflow
- `git init -b main`. One Conventional Commit per phase (messages above). Co-author trailer on each commit.
- **No GitHub repo creation or push without an explicit go-ahead.**
- The final state has `git status` clean.

---

## 10. Trade-offs (for the README)
- Upload with multipart or a presigned URL, with resumable uploads, instead of base64 JSON.
- Background sync (`expo-background-task`) to drain the queue while the app is closed.
- A real backend: DB unique constraint on the idempotency key, key TTL, auth, per-user key scope.
- A schema library (zod) instead of hand-written type guards.
- Backoff jitter. Tell apart "online but server unreachable". Parallel uploads with a limit.
- Encryption at rest if needed. Cleanup policy for photos of synced deliveries.
- Android can kill the app while the camera is open. Recover the photo with `ImagePicker.getPendingResultAsync()` (not in the prototype).
- Conflict handling if records become editable (currently create-only).
- On-device repository integration tests and Maestro E2E.
- Observability: structured logs, crash reporting (Sentry).

---

## 11. Requirement traceability (brief → task)

| Brief requirement | Covered by |
|---|---|
| Photo: take or choose | 2.1, 2.3 |
| Photo persisted beyond temp URI, compressed | 2.2, §3.2 |
| Supplier / PO / Note + validation | 2.4, 2.6, 7.3 |
| Save fully offline | 2.5–2.7 |
| Shows immediately in the local queue | 2.6 (`router.replace`), 3.1, 3.5 |
| UI reads SQLite, not the API | 1.5, 3.1, §4.9 |
| SQLite table with all listed fields | 1.1, 1.2, §4.2 |
| UUID ids + `delivery-<uuid>` key | 1.4 |
| Survives restart / kill / network loss | 1.7, 2.7, scenario 2 |
| 4 visually distinct statuses | 3.4 |
| "Queued · Waiting for connection" | 3.4 |
| "Failed · Retrying…" and "Failed · [Retry]" | 3.4, §4.3 |
| "Upload failed — still saved locally" | 3.4, 3.6 |
| ● Online / ● Offline | 3.2, 3.3 |
| Explicit sync engine | 5.2–5.4 |
| No concurrent upload of the same delivery | 5.4 single-flight + 1.5/5.2 atomic claim + 7.2e |
| Offline → online triggers sync | 5.5, 7.2h |
| Sync on start, queue open, after create | 5.6, 3.7, 2.5 |
| Backoff with a cap, persisted | 5.1, 5.2, 7.1 |
| Manual Retry | 3.4, 3.6, 5.7 |
| Idempotency-Key; server dedupes | 4.2, 4.3, 4.4 |
| Duplicate demo | 6.2, 6.3, scenario 6 |
| Double-tap protection | 2.6, scenario 6b |
| Persist `uploading` before the request | 5.2 (claim) |
| Recover `uploading` on launch | 5.6, 7.2f, scenario 5 |
| `DeliveryApi` interface | 4.2, 5.4 |
| Mock: remote id, idempotency, failure, delay | 4.3, 6.1 |
| Errors: no internet / invalid form / permission / photo missing / timeout / 5xx / malformed / restart / duplicate | 5.4 · 2.4 · 2.1 · 2.2 + 4.2 · scen. 7 · scen. 4 · scen. 8 · 5.6 · 4.3 |
| Never silently lose a delivery | 5.2, 2.5 |
| Strict TS, typed layers, no DB/sync code in screens | 0.2, 1.5, 4.2, §4.1 rule, 3.1 |
| No Redux / AsyncStorage DB / extra deps | §3.1 |
| Secure storage only where appropriate | Not needed: no credentials (§8) |
| README (7 sections) | 8.1 |
| Demo-ready | §7, 8.4 |
| No secrets; git clean and runnable | 0.5, 8.5 |

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| The phone can't reach the laptop mock server | LAN IP in `.env`, same Wi-Fi, dev screen shows the configured URL; Android emulator uses `10.0.2.2`. |
| Android blocks cleartext HTTP | Expo Go allows it. A dev build would need `expo-build-properties` `usesCleartextTraffic` (documented). |
| iOS Simulator: no camera, no airplane mode | Record on a physical phone. Simulator fallback: Choose Photo + turn off the Mac's Wi-Fi. |
| `isInternetReachable` is `null` at launch | Treated as reachable if connected. A failed request just goes into retry. |
| Laptop macOS firewall blocks port 4000 | README note: allow incoming connections for `node`. |
| App killed mid SQLite write | Each state change is one atomic statement under WAL. The row is either the old or the new state. |
| Time overrun | Cut order in §5. Phases 1, 2 and 5 are protected. |

---

## 12a. Implementation notes (deviations from this plan)

| Plan | As built | Why |
|---|---|---|
| Routes in root `app/` | `src/app/` | The SDK 57 template's convention |
| `@expo/vector-icons` from the template | Not used; text glyphs (✓ ● ⚙︎) | The SDK 57 template no longer ships it; avoids a dependency |
| Claim SQL `next_attempt_at IS NULL OR <= now` | `status='queued' OR (status='failed' AND next_attempt_at IS NOT NULL AND next_attempt_at <= now)` | Exhausted failures (null) must wait for manual Retry |
| `SyncEngine.start()` awaits the first sync | Resolves after recovery; the first sync runs in the background | App launch must not wait up to 15 s on a dead server |
| — | `react-dom` 19.2.3 and `@types/node` as dev deps | `jest-expo` peer resolution; Node types for the integration tests (TS 6 needs explicit `types`) |
| — | `HttpDeliveryApi(baseUrl, fetch?)` | The jest-expo preset replaces global fetch; the integration tests inject a `node:http` fetch |
| Task 1.7 debug button | SQL checked with `node:sqlite`, plus the on-simulator run below | No throwaway UI needed |

**Runtime verification (iOS Simulator, Expo Go 57.0.9, 2026-09-30):**
- The queue, capture and details screens render.
- A row seeded as `uploading` plus a server copy of it went: cold start → `recovered 1 interrupted upload(s)` → `synced (replayed)`. The server logged `NEW` then `REPLAY` with the same remoteId.
- A second, queued row synced as `NEW`.

**Not yet exercised by hand:** camera/library capture, airplane-mode toggling and the dev-screen toggles. These need taps on a device; see README §6.

## 13. Gates

| Gate | Status |
|---|---|
| Gate 1 — Classification & requirements | ✅ Approved |
| Gate 2 — Applications + stack (§2, §3) | ✅ Approved 2026-09-30 |
| Gate 3 — Architecture (§4) | ✅ Approved 2026-09-30 |
| Gate 4 — Phases + tasks (§5) | ✅ Approved 2026-09-30 |
| Implementation | ⏳ Not started. Next: Phase 0. |
