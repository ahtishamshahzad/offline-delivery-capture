# Mobile app

Expo SDK 57 · React Native 0.86 · TypeScript (strict) · Expo Router. Runs in **Expo Go** on iOS and Android.

A foreman photographs a delivery ticket, enters supplier, PO number and note, and saves. The delivery is stored on the device first and uploaded in the background when the device is online.

## Run

```bash
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_URL (see below)
npm run server            # mock API, separate terminal
npx expo start            # scan the QR code with Expo Go
```

| Env var | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the [mock server](../mock-server/README.md), reachable from the device (laptop LAN IP; `localhost` on the iOS Simulator; `10.0.2.2` on the Android emulator). Public config, bundled into the app, and not a secret. |

## Docs

| Doc | Contents |
|---|---|
| [screens/](screens/README.md) | One file per screen: route, what it shows, actions, states, failure modes |
| [navigation.md](navigation.md) | Routes, stack, startup bootstrap |
| [state.md](state.md) | SQLite schema, settings, how the UI stays live |
| [sync.md](sync.md) | Sync engine: triggers, claim, retry policy, recovery, error mapping |
| [native.md](native.md) | Camera/library, photo storage, connectivity, permissions |

## Where things live

`src/app` (routes) · `src/screens` · `src/components` · `src/hooks` · `src/repositories` · `src/database` · `src/sync` · `src/services` · `src/types` · `src/utils`. Layer rules are in [architecture/overview.md](../architecture/overview.md#module-map-mobile).
