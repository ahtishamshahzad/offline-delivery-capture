import { useMemo } from 'react';

import { retryDelivery, syncEngine, type SyncReason } from '@/sync';
import type { Delivery } from '@/types/delivery';

export interface QueueSummary {
  pending: number;
  failed: number;
  synced: number;
}

export function summarize(deliveries: Delivery[]): QueueSummary {
  return deliveries.reduce<QueueSummary>(
    (acc, d) => {
      if (d.status === 'synced') acc.synced += 1;
      else if (d.status === 'failed') acc.failed += 1;
      else acc.pending += 1;
      return acc;
    },
    { pending: 0, failed: 0, synced: 0 },
  );
}

/** The UI's only door into the sync engine. */
export function useSyncQueue() {
  return useMemo(
    () => ({
      syncNow: (reason: SyncReason) => void syncEngine.requestSync(reason),
      retry: (id: string) =>
        retryDelivery(id).catch((error: unknown) => console.warn('[sync] retry failed', error)),
    }),
    [],
  );
}
