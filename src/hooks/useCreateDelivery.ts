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
      photoPath = await persistPhoto(values.photoUri, draftId);
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
