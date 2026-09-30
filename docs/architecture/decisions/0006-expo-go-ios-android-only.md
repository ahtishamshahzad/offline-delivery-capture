# 0006 — Expo Go, iOS + Android only

**Status:** Accepted · 2026-09-30

## Context
Reviewers should be able to run the app quickly on a phone. Every native module needed ships in Expo Go SDK 57.

## Decision
- Target Expo Go (SDK 57). No custom dev build, and no `ios/` or `android/` folders are committed.
- `app.json` declares `"platforms": ["ios", "android"]`. Web is not supported: `react-native-web` was removed with the template demo code, and `expo-sqlite` on web would need WASM.
- Routes live in `src/app/`, following the SDK 57 template. Icons are text glyphs (✓ ● ⚙︎) because the template no longer ships `@expo/vector-icons`.

## Consequences
- Setup is `npm install`, `npm run server`, then `npx expo start`.
- Android cleartext HTTP to the LAN mock works in Expo Go; a dev build would need `usesCleartextTraffic`.
- `expo export --platform all` builds iOS and Android only. This was fixed in PR #2; before it, `all` failed trying to bundle web.

## Alternatives rejected
- **A development build:** slower to set up, with no benefit, since every module is in Expo Go.
- **Supporting web:** out of scope for a field app, and it would pull in `react-native-web` plus SQLite WASM.
