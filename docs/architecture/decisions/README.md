# Architecture decision records

One file per decision: context, decision, consequences, and the alternatives rejected. All were decided on 2026-09-30 during planning or build.

| # | Decision | Status |
|---|---|---|
| [0001](0001-sqlite-outbox-source-of-truth.md) | SQLite outbox is the single source of truth for the UI | Accepted |
| [0002](0002-idempotency-key-and-atomic-claim.md) | Stable idempotency key + atomic claim against duplicates | Accepted |
| [0003](0003-recover-uploading-on-launch.md) | Recover `uploading` rows on launch, before the first sync | Accepted |
| [0004](0004-no-tanstack-query-or-global-store.md) | No TanStack Query, Redux or AsyncStorage | Accepted |
| [0005](0005-zero-dependency-mock-server.md) | Zero-dependency Node mock server, base64 JSON uploads | Accepted |
| [0006](0006-expo-go-ios-android-only.md) | Expo Go, iOS + Android only | Accepted |
