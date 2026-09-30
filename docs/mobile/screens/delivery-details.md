# Delivery details

**Route:** `/delivery/[id]` · **Source:** `src/screens/DeliveryDetailsScreen.tsx` · **Hooks:** `useDelivery`, `useNetworkStatus`, `useSyncQueue`

## Shows
- **Photo:** the full ticket photo, or "Photo file is missing on this device".
- **Status:** the status badge (same as the [queue](delivery-queue.md)). If the upload failed: "Upload failed. Your delivery is still saved on this device." and a **Retry upload** button.
- **Fields:** supplier, PO number, note, capture time.
- **Sync details, selectable for copying:**
  - local id, idempotency key and remote id
  - **Server replay:** "Yes — duplicate prevented" or "No — first upload"
  - failed attempts, last attempt, next automatic retry, last error

Updates live while open: it re-reads SQLite after every repository write.

## Failure modes
- **Unknown id:** "Delivery not found".
