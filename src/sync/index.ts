import { AppState } from 'react-native';

import { deliveryRepository, deliveryStore } from '@/repositories/deliveryRepository';
import { settingsRepository } from '@/repositories/settingsRepository';
import { HttpDeliveryApi } from '@/services/api';
import { netInfoMonitor } from '@/services/network';
import { now } from '@/utils/time';

import { SyncEngine } from './SyncEngine';

/**
 * The app's single sync engine, wired to real SQLite, HTTP and NetInfo.
 * `api` is where uploads go: HttpDeliveryApi → EXPO_PUBLIC_API_URL.
 * Started once by useAppBootstrap; UI reaches it only via hooks.
 */
export const syncEngine = new SyncEngine({
  store: deliveryStore,
  api: new HttpDeliveryApi(),
  network: netInfoMonitor,
  clock: now,
  getDevSettings: __DEV__ ? () => settingsRepository.getDevSettings() : undefined,
  subscribeForeground: (onForeground) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') onForeground();
    });
    return () => subscription.remove();
  },
  log: __DEV__ ? (message) => console.log(`[sync] ${message}`) : undefined,
});

/** Manual Retry: reset backoff state (row rejoins the queue), then sync immediately. */
export async function retryDelivery(id: string): Promise<void> {
  await deliveryRepository.resetForManualRetry(id, now());
  await syncEngine.requestSync('manual');
}

export type { SyncReason } from './SyncEngine';
