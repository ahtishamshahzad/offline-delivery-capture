import { useEffect, useState } from 'react';

import { netInfoMonitor } from '@/services/network';

/** true = online, false = offline, null = not known yet. */
export function useNetworkStatus(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => netInfoMonitor.subscribe(setOnline), []);
  return online;
}
