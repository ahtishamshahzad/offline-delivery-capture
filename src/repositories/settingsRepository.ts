import { getDb } from '@/database/database';
import {
  DEFAULT_DEV_SETTINGS,
  FAILURE_MODES,
  UPLOAD_DELAYS_MS,
  type DevSettings,
  type FailureMode,
  type UploadDelayMs,
} from '@/types/settings';

type Listener = () => void;
const listeners = new Set<Listener>();

function parseFailureMode(value: string | undefined): FailureMode {
  return FAILURE_MODES.find((mode) => mode === value) ?? DEFAULT_DEV_SETTINGS.failureMode;
}

function parseUploadDelay(value: string | undefined): UploadDelayMs {
  return UPLOAD_DELAYS_MS.find((delay) => String(delay) === value) ?? DEFAULT_DEV_SETTINGS.uploadDelayMs;
}

export const settingsRepository = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async getDevSettings(): Promise<DevSettings> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key IN ('failureMode', 'uploadDelayMs')`,
    );
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return {
      failureMode: parseFailureMode(values.get('failureMode')),
      uploadDelayMs: parseUploadDelay(values.get('uploadDelayMs')),
    };
  },

  async setDevSetting<K extends keyof DevSettings>(key: K, value: DevSettings[K]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      String(value),
    );
    listeners.forEach((listener) => listener());
  },
};
