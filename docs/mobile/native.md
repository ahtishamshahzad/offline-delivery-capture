# Native capabilities

All of these ship in Expo Go SDK 57; no custom native code.

## Photo (`src/services/photoService.ts`)
| Step | API |
|---|---|
| Take photo | `ImagePicker.requestCameraPermissionsAsync()` then `launchCameraAsync({ mediaTypes: ['images'], quality: 1 })` |
| Choose photo | `launchImageLibraryAsync(...)`. No permission prompt is needed for picking |
| Resize + compress | `ImageManipulator.manipulate(uri).resize({ width: 1280 }).renderAsync()`, then `saveAsync({ compress: 0.6, format: JPEG })`. This writes to the **cache** dir |
| Persist | `File.copy()` into `Paths.document/photos/<id>.jpg`; the stored path is relative |
| Read for upload | `File.base64()`; a missing file becomes `PhotoMissingError` |
| Delete | a single photo if the insert fails; all photos on Reset demo data |

Permission text is set in `app.json` via the `expo-image-picker` plugin (`cameraPermission`, `photosPermission`).

## Connectivity (`src/services/network.ts`)
- Online means `isConnected === true && isInternetReachable !== false`. `null` right after launch counts as reachable; a failed request just goes into retry.
- `NetworkMonitor` interface (`isOnline`, `subscribe`), so tests can use a fake network.

## Background behaviour
Sync runs only while the app is running (on start, foreground, reconnect, timers). No background task is registered. That's listed as a production trade-off in the root README.

## Known platform limits
- **iOS Simulator:** no camera (use Choose Photo) and no airplane mode.
- **Android:** the OS may kill the app while the camera is open. `ImagePicker.getPendingResultAsync()` recovery is not implemented.
