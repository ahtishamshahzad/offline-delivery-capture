import { useCallback, useRef, useState } from 'react';

import { deliveryRepository } from '@/repositories/deliveryRepository';
import { deletePhoto, persistPhoto } from '@/services/photoService';
import { syncEngine } from '@/sync';
import { now } from '@/utils/time';
import type { DeliveryFormValues } from '@/utils/validation';

type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * Save flow: copy photo into app storage → insert a `queued` row → nudge sync.
 * Works fully offline; the network is only touched by the sync engine.
 *
 * This is where a delivery ENTERS THE QUEUE. What happens next (claim →
 * upload → synced/failed) is in SyncEngine / uploadDelivery.
 */
export function useCreateDelivery() {
  const [saving, setSaving] = useState(false);
  // A ref, not state: blocks a second tap before React re-renders.
  const inFlight = useRef(false);

  const save = useCallback(async (draftId: string, values: DeliveryFormValues): Promise<SaveResult> => {
    if (inFlight.current) return { ok: false, message: 'Already saving' };
    if (!values.photoUri) return { ok: false, message: 'Photo is required' };
    inFlight.current = true;
    setSaving(true);

    let photoPath: string | null = null;
    try {
      // 1. Photo: resize/compress and copy out of the picker's temp location.
      photoPath = await persistPhoto(values.photoUri, draftId);
      // 2. SQLite first: status 'queued'. notify() makes the card appear at once.
      await deliveryRepository.create(
        {
          id: draftId,
          supplierName: values.supplierName.trim(),
          poNumber: values.poNumber.trim(),
          note: values.note.trim(),
          photoPath,
        },
        now(),
      );
      // 3. Nudge the engine; it uploads only if online. Not awaited, so saving
      //    never waits on the network.
      void syncEngine.requestSync('created');
      return { ok: true };
    } catch (error) {
      if (photoPath) {
        try {
          deletePhoto(photoPath);
        } catch {
          // Best effort; an orphaned file is harmless.
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not save delivery',
      };
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, []);

  return { save, saving };
}
