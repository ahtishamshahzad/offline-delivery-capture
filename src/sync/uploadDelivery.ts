import type { Delivery } from '@/types/delivery';
import { toUserMessage } from '@/utils/errors';

import { nextDelayMs, shouldAutoRetry } from './retryPolicy';
import type { SyncDeps } from './types';

export type UploadOutcome = 'synced' | 'failed' | 'skipped';

/**
 * Upload one delivery.
 *
 * 1. Atomically claim it (queued|due-failed → uploading) and persist that
 *    BEFORE the request, so a killed process leaves evidence we can recover.
 * 2. Upload with the delivery's stable idempotency key.
 * 3. Record the result. The local row is never deleted.
 */
export async function uploadDelivery(delivery: Delivery, deps: SyncDeps): Promise<UploadOutcome> {
  const claimed = await deps.store.claimForUpload(delivery.id, deps.clock());
  if (!claimed) return 'skipped';

  try {
    const devSettings = await deps.getDevSettings?.();
    const result = await deps.api.uploadDelivery(delivery, devSettings);
    await deps.store.markSynced(delivery.id, result.remoteId, result.replayed, deps.clock());
    deps.log?.(`synced ${delivery.id}${result.replayed ? ' (replayed)' : ''}`);
    return 'synced';
  } catch (error) {
    const failedAttempts = delivery.retryCount + 1;
    const nextAttemptAt = shouldAutoRetry(error, failedAttempts)
      ? deps.clock() + nextDelayMs(failedAttempts)
      : null;
    await deps.store.markFailed(
      delivery.id,
      { errorMessage: toUserMessage(error), retryCount: failedAttempts, nextAttemptAt },
      deps.clock(),
    );
    deps.log?.(`failed ${delivery.id}: ${toUserMessage(error)}`);
    return 'failed';
  }
}
