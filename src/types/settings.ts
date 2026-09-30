export const FAILURE_MODES = ['off', 'server_error', 'malformed', 'timeout'] as const;
export type FailureMode = (typeof FAILURE_MODES)[number];

export const UPLOAD_DELAYS_MS = [0, 2000, 8000] as const;
export type UploadDelayMs = (typeof UPLOAD_DELAYS_MS)[number];

/** Development-only knobs sent to the mock server as X-Simulate-* headers. */
export interface DevSettings {
  failureMode: FailureMode;
  uploadDelayMs: UploadDelayMs;
}

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  failureMode: 'off',
  uploadDelayMs: 0,
};
