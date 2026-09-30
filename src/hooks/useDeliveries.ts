import { useCallback, useEffect, useState } from 'react';

import { deliveryRepository } from '@/repositories/deliveryRepository';
import type { Delivery } from '@/types/delivery';

/** Re-runs `load` now and after every repository write. */
function useRepositoryQuery<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      load()
        .then((result) => {
          if (active) setData(result);
        })
        .catch((error: unknown) => console.warn('[db] query failed', error))
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    refresh();
    const unsubscribe = deliveryRepository.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [load]);

  return { data, loading };
}

/** All deliveries, newest first, live from SQLite. */
export function useDeliveries() {
  const { data, loading } = useRepositoryQuery<Delivery[]>(deliveryRepository.listAll, []);
  return { deliveries: data, loading };
}

/** One delivery, live from SQLite. */
export function useDelivery(id: string) {
  const load = useCallback(() => deliveryRepository.getById(id), [id]);
  const { data, loading } = useRepositoryQuery<Delivery | null>(load, null);
  return { delivery: data, loading };
}
