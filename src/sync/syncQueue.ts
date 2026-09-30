import type { SyncDeps } from './types';
import { uploadDelivery, type UploadOutcome } from './uploadDelivery';

/**
 * Upload every due delivery, oldest first, one at a time. Sequential keeps
 * the logic simple and is gentle on a weak field connection.
 */
export async function processDueDeliveries(deps: SyncDeps): Promise<UploadOutcome[]> {
  const due = await deps.store.getDueDeliveries(deps.clock());
  const outcomes: UploadOutcome[] = [];
  for (const delivery of due) {
    // Connection may drop mid-queue; stop instead of failing every remaining row.
    if (!(await deps.network.isOnline())) break;
    outcomes.push(await uploadDelivery(delivery, deps));
  }
  return outcomes;
}
