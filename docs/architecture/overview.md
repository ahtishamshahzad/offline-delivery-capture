# System overview

```text
┌──────────── Mobile app (Expo, on the device) ────────────┐        ┌──── Mock server (Node) ────┐
│ screens → hooks → repository → SQLite (source of truth)  │        │ POST /deliveries            │
│                     ▲             ▲                       │  HTTP  │   Idempotency-Key → store   │
│                     └── SyncEngine ┴── DeliveryApi ───────┼───────►│ GET / DELETE /deliveries    │
│                         (NetInfo, AppState, timers)       │        │ data/db.json + photos/      │
└───────────────────────────────────────────────────────────┘        └─────────────────────────────┘
```

The two applications share one contract, the [deliveries API](../mock-server/api/deliveries.md). The app never reads server state back for display: the server only confirms an upload (`remoteId`, `replayed`), and that result is written to SQLite.

## Module map (mobile)

| Layer | Path | Rule |
|---|---|---|
| Routes | `src/app/` | Thin: bootstrap + re-export screens ([navigation](../mobile/navigation.md)) |
| Screens / components | `src/screens/`, `src/components/` | UI only. Import hooks and components, never `database/`, `repositories/` or `sync/` |
| Hooks | `src/hooks/` | The only callers of repositories, services and the sync engine |
| Repositories | `src/repositories/` | Typed, parameterized SQL; emit change events after writes ([state](../mobile/state.md)) |
| Database | `src/database/` | One connection, WAL, `PRAGMA user_version` migrations |
| Sync | `src/sync/` | Engine and policies; depends on interfaces only ([sync](../mobile/sync.md)) |
| Services | `src/services/` | `DeliveryApi` over fetch, NetInfo wrapper, photo storage ([native](../mobile/native.md)) |

## Where the key guarantees live

| Guarantee | Enforced in |
|---|---|
| UI shows local data only | `src/hooks/useDeliveries.ts` subscribes to `deliveryRepository` change events |
| No lost delivery | Save = photo copy + INSERT before any network; rows are never deleted by sync (`src/sync/uploadDelivery.ts`) |
| No double upload | Single-flight `SyncEngine.requestSync` + atomic `claimForUpload` (`changes === 1`) |
| Survives kill mid-upload | `uploading` persisted before the request; `recoverInterrupted()` at start ([ADR 0003](decisions/0003-recover-uploading-on-launch.md)) |
| No server duplicate | Stable `Idempotency-Key`; server stores before responding ([ADR 0002](decisions/0002-idempotency-key-and-atomic-claim.md)) |
