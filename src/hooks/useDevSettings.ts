import { useCallback, useEffect, useState } from 'react';

import { API_URL } from '@/config';
import { deliveryRepository } from '@/repositories/deliveryRepository';
import { settingsRepository } from '@/repositories/settingsRepository';
import { fetchServerDeliveryCount, HttpDeliveryApi, type UploadResult } from '@/services/api';
import { DEFAULT_DEV_SETTINGS, type DevSettings } from '@/types/settings';
import { toUserMessage } from '@/utils/errors';

export type ResendResult =
  | { ok: true; result: UploadResult; supplierName: string; localRemoteId: string | null }
  | { ok: false; message: string };

export function useDevSettings() {
  const [settings, setSettings] = useState<DevSettings>(DEFAULT_DEV_SETTINGS);

  useEffect(() => {
    const load = () => {
      settingsRepository.getDevSettings().then(setSettings).catch(console.warn);
    };
    load();
    return settingsRepository.subscribe(load);
  }, []);

  const update = useCallback(<K extends keyof DevSettings>(key: K, value: DevSettings[K]) => {
    settingsRepository.setDevSetting(key, value).catch(console.warn);
  }, []);

  /** Re-send the most recent synced delivery with its original idempotency key. */
  const resendLastSynced = useCallback(async (): Promise<ResendResult> => {
    const delivery = await deliveryRepository.getLastSynced();
    if (!delivery) return { ok: false, message: 'No synced delivery yet' };
    try {
      const result = await new HttpDeliveryApi().uploadDelivery(delivery);
      return { ok: true, result, supplierName: delivery.supplierName, localRemoteId: delivery.remoteId };
    } catch (error) {
      return { ok: false, message: toUserMessage(error) };
    }
  }, []);

  const serverCount = useCallback(async (): Promise<number | string> => {
    try {
      return await fetchServerDeliveryCount();
    } catch (error) {
      return toUserMessage(error);
    }
  }, []);

  return { settings, update, resendLastSynced, serverCount, apiUrl: API_URL };
}
