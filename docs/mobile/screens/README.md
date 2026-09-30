# Screens

| Screen | Route | Source | Purpose |
|---|---|---|---|
| [Delivery Queue](delivery-queue.md) | `/` | `src/screens/QueueScreen.tsx` | Home: every delivery with live sync status, connectivity banner |
| [Material Delivery (capture)](capture.md) | `/capture` | `src/screens/CaptureScreen.tsx` | Photo + supplier + PO + note → save offline |
| [Delivery details](delivery-details.md) | `/delivery/[id]` | `src/screens/DeliveryDetailsScreen.tsx` | Full photo, fields, sync diagnostics, Retry |
| [Developer settings](dev-settings.md) | `/dev` | `src/screens/DevSettingsScreen.tsx` | Dev builds only: failure/delay simulation, duplicate demo, reset |
