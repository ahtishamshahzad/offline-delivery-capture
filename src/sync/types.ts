import type { DeliveryStore } from '@/repositories/deliveryRepository';
import type { DeliveryApi } from '@/services/api';
import type { NetworkMonitor } from '@/services/network';
import type { DevSettings } from '@/types/settings';

/** Everything the sync engine touches, injected so tests can use fakes. */
export interface SyncDeps {
  store: DeliveryStore;
  api: DeliveryApi;
  network: NetworkMonitor;
  clock: () => number;
  getDevSettings?: () => Promise<DevSettings>;
  /** Calls back when the app returns to the foreground. */
  subscribeForeground?: (onForeground: () => void) => () => void;
  log?: (message: string) => void;
}
