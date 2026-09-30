import { useEffect, useState } from 'react';

import { getDb } from '@/database/database';
import { syncEngine } from '@/sync';

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/** Open + migrate SQLite, recover interrupted uploads, start the sync engine. */
export function useAppBootstrap(): BootState {
  const [state, setState] = useState<BootState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDb();
        await syncEngine.start();
        if (!cancelled) setState({ status: 'ready' });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not open local database',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
