# Material Delivery (capture)

**Route:** `/capture` · **Source:** `src/screens/CaptureScreen.tsx` · **Hooks:** `useCreateDelivery`, `usePhotoCapture`

## Fields
| Field | Rule (`src/utils/validation.ts`) |
|---|---|
| Delivery ticket photo | Required. **Take Photo** (camera) or **Choose Photo** (library) |
| Supplier Name | Required, trimmed, ≤ 100 chars |
| PO Number | Required, ≤ 40 chars, letters/digits/space/`-_/` only |
| Note | Optional, ≤ 500 chars |

Errors appear inline under each field and clear as the user edits it.

## Save
1. Validate. If anything is invalid, nothing is saved.
2. Resize (1280 px wide) and compress (JPEG 0.6), then copy the photo to `<document dir>/photos/<id>.jpg`.
3. `INSERT … ON CONFLICT(id) DO NOTHING` a `queued` row. The id is generated **once when the form opens**, so re-saving the same form can't create a second row.
4. Ask the sync engine to run (`created` trigger), then go back to the queue.

Save works fully offline; nothing in this flow touches the network. The button shows a spinner and is locked while saving, which blocks a double tap before React re-renders.

## Failure modes
| Case | Behaviour |
|---|---|
| Camera permission denied | Dialog with **Open Settings**; Choose Photo still works |
| No camera (iOS Simulator) | "Camera unavailable — use Choose Photo" |
| User cancels the picker | Nothing happens |
| Database insert fails | The copied photo is deleted, an alert shows the error, and the form keeps its values |
