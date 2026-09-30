# Navigation

Expo Router, file-based, rooted at `src/app/`. A single native stack.

| File | Route | Renders |
|---|---|---|
| `src/app/_layout.tsx` | — | Startup bootstrap, then `<Stack>` |
| `src/app/index.tsx` | `/` | [Delivery Queue](screens/delivery-queue.md) |
| `src/app/capture.tsx` | `/capture` | [Capture](screens/capture.md) |
| `src/app/delivery/[id].tsx` | `/delivery/:id` | [Details](screens/delivery-details.md) |
| `src/app/dev.tsx` | `/dev` | [Developer settings](screens/dev-settings.md) (redirects to `/` outside `__DEV__`) |

Route files only re-export screens; screen titles are set inside each screen with `<Stack.Screen options>`.

## Startup (`useAppBootstrap`)
1. Open and migrate SQLite (`getDb()`).
2. `syncEngine.start()`: recover interrupted uploads, subscribe to NetInfo and AppState, and fire the first sync in the background.
3. Render the stack. A spinner shows until then; if the database can't be opened, an error screen says "Could not open local storage".

**Deep links** (scheme `deliverycapture`; in Expo Go, `exp://<host>:<port>/--/<route>`) open any route directly, e.g. `/capture` or `/delivery/<id>`.
