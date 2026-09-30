# Delivery Queue

**Route:** `/` (home) · **Source:** `src/screens/QueueScreen.tsx` · **Hooks:** `useDeliveries`, `useNetworkStatus`, `useSyncQueue`

## Shows
- **Connectivity banner:** "● Online" (green) or "● Offline — deliveries are saved and will sync when connection returns" (amber). Hidden until NetInfo reports a first value.
- **Summary line:** `N pending · N failed · N synced`.
- **One card per delivery, newest first:**
  - photo thumbnail
  - supplier, PO and `#<first 6 of id>`
  - relative capture time
  - status badge (next table)
  - the last error message, if the delivery failed
- **Empty state:** "No deliveries yet".

| Status | Badge | Detail text |
|---|---|---|
| queued | grey **Queued** | "Waiting for connection" when offline, "Waiting to upload" when online |
| uploading | blue **Uploading…** + spinner | "Sending to server" |
| synced | green **Synced ✓** | "Saved on server", or "Server already had it (no duplicate)" if replayed |
| failed, auto retry pending | red **Failed** + **[Retry now]** | "Retrying in Ns" (live countdown), or "Will retry when back online" |
| failed, needs the user | red **Failed** + **[Retry]** | "Upload failed — still saved on this device" |

## Actions
| Action | Effect |
|---|---|
| **+ New Delivery** | Opens [capture](capture.md) |
| Tap a card | Opens [details](delivery-details.md) |
| Retry / Retry now | Resets retry state, re-queues the delivery and syncs immediately (`retryDelivery`) |
| ⚙︎ (header, dev builds only) | Opens [developer settings](dev-settings.md) |
| Screen gains focus | Requests a sync (`queue-focus` trigger) |

## Failure modes
- **Offline:** not an error. Cards stay Queued and the banner explains why.
- **Photo file missing:** the card shows a "No photo" placeholder. An upload attempt fails with "Photo missing on device" and waits for Retry.
