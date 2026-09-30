# 0004 — No TanStack Query, Redux or AsyncStorage

**Status:** Accepted · 2026-09-30

## Context
The brief allows TanStack Query "only where it provides value" and asks to avoid unnecessary libraries and over-engineered state.

## Decision
- **Server state:** none is displayed; all UI data is local (see [0001](0001-sqlite-outbox-source-of-truth.md)).
- **Global state:** none. Form state is component state; queue state is SQLite.
- **Settings** (dev failure mode, delay) live in the SQLite `app_settings` table, not AsyncStorage.

## Consequences
- One source of truth, and no cache invalidation to reason about.
- Fewer dependencies. The runtime additions are only `expo-sqlite`, `expo-file-system`, `expo-image-picker`, `expo-image-manipulator`, `expo-crypto` and NetInfo.

## Alternatives rejected
- **TanStack Query** over the repository: it adds a second cache and invalidation for data that is already local and reactive.
- **Redux / Zustand:** no shared, non-persistent state exists to manage.
- **AsyncStorage for settings:** it would be a second storage mechanism for two keys.
