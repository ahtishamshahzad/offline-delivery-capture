# 0001 — SQLite outbox is the single source of truth

**Status:** Accepted · 2026-09-30

## Context
Foremen capture deliveries with no signal. A capture must never depend on the network, must survive restarts and process death, and its sync status must be visible at all times.

## Decision
- Every delivery is written to the `deliveries` table in `expo-sqlite` **before** any network activity. That table is also the upload queue (outbox): `status` is `queued | uploading | synced | failed`.
- The UI reads only from SQLite. The repository emits a change event after each write, and hooks re-query on it.
- Upload results (`remote_id`, `remote_replayed`, errors, retry state) are written back to the same row; the API response is never rendered directly.
- WAL journal mode; schema versioned with `PRAGMA user_version`.

## Consequences
- Offline capture and "see it immediately" are the same code path as online.
- Status survives restarts because it is stored, not held in memory.
- The UI reflects sync-engine changes live without a second cache.
- Repository SQL is only testable on a device (the native module); engine logic is tested against an in-memory fake with the same semantics.

## Alternatives rejected
- **AsyncStorage** as the store: no queries, no atomic conditional update for the claim step.
- **A query cache (TanStack Query) as the store:** in-memory first, with persistence bolted on; it would hold a second copy of data the database already holds.
- **Drizzle / an ORM:** extra dependency and setup for a single table.
- **`addDatabaseChangeListener`:** works, but an explicit emitter in the repository is easier to explain and to fake in tests.
