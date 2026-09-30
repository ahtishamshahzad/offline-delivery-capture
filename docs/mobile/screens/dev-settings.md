# Developer settings

**Route:** `/dev` · **Source:** `src/screens/DevSettingsScreen.tsx` · **Hook:** `useDevSettings`
**Availability:** dev builds only (`__DEV__`). In a release build the route redirects to `/`, and the simulation headers are never sent.

| Section | What it does |
|---|---|
| Mock server | Shows the configured `EXPO_PUBLIC_API_URL` and the server's delivery count (`GET /deliveries`), with Refresh |
| Simulate upload failure | Off / Server error / Malformed / Timeout. Sent as `X-Simulate-Failure` on every upload until switched off |
| Upload delay | 0 / 2 / 8 s. Sent as `X-Simulate-Delay-Ms`; use 8 s to kill the app while a card shows Uploading… |
| Duplicate protection | **Re-send last synced delivery** with its original idempotency key. Shows `replayed`, the server's and the local `remoteId`, and "✓ Same delivery — no duplicate created" |
| Start a demo from scratch | **Reset demo data** (asks for confirmation): deletes all local deliveries and photos, resets both simulations and clears the mock server. The local part works offline; the result line says if the server couldn't be reached |

Settings are stored in the SQLite `app_settings` table and survive restarts. See the [API contract](../../mock-server/api/deliveries.md) for exactly how the server reacts to each header.
