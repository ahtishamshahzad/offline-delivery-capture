import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/** Minimal connectivity contract so the sync engine can be tested with a fake. */
export interface NetworkMonitor {
  isOnline(): Promise<boolean>;
  subscribe(listener: (online: boolean) => void): () => void;
}

/**
 * Online = connected and not known to be unreachable. `isInternetReachable`
 * is null right after launch; treat unknown as reachable — a failed request
 * simply goes into retry.
 */
export function isOnlineState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export const netInfoMonitor: NetworkMonitor = {
  async isOnline() {
    return isOnlineState(await NetInfo.fetch());
  },
  // SyncEngine.start() subscribes here; an offline → online change fires
  // requestSync('reconnect'), which uploads everything still queued.
  subscribe(listener) {
    return NetInfo.addEventListener((state) => listener(isOnlineState(state)));
  },
};
