import type { DeliveryStore, FailureUpdate } from '@/repositories/deliveryRepository';
import type { DeliveryApi, UploadResult } from '@/services/api';
import type { NetworkMonitor } from '@/services/network';
import type { SyncDeps } from '@/sync/types';
import type { Delivery } from '@/types/delivery';

/** In-memory DeliveryStore with the same semantics as the SQLite queries. */
export class FakeStore implements DeliveryStore {
  rows = new Map<string, Delivery>();

  add(partial: Partial<Delivery> & { id: string }): Delivery {
    const delivery: Delivery = {
      supplierName: 'ABC Materials',
      poNumber: 'PO-1024',
      note: '',
      photoPath: `photos/${partial.id}.jpg`,
      status: 'queued',
      retryCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      createdAt: this.rows.size,
      updatedAt: 0,
      remoteId: null,
      remoteReplayed: false,
      idempotencyKey: `delivery-${partial.id}`,
      errorMessage: null,
      ...partial,
    };
    this.rows.set(delivery.id, delivery);
    return delivery;
  }

  get(id: string): Delivery {
    const row = this.rows.get(id);
    if (!row) throw new Error(`no row ${id}`);
    return row;
  }

  private isDue(d: Delivery, now: number): boolean {
    return d.status === 'queued' || (d.status === 'failed' && d.nextAttemptAt !== null && d.nextAttemptAt <= now);
  }

  private patch(id: string, changes: Partial<Delivery>): void {
    this.rows.set(id, { ...this.get(id), ...changes });
  }

  async getDueDeliveries(now: number) {
    return [...this.rows.values()].filter((d) => this.isDue(d, now)).sort((a, b) => a.createdAt - b.createdAt);
  }

  async getNextScheduledAttempt() {
    const times = [...this.rows.values()]
      .filter((d) => d.status === 'failed' && d.nextAttemptAt !== null)
      .map((d) => d.nextAttemptAt as number);
    return times.length ? Math.min(...times) : null;
  }

  async claimForUpload(id: string, now: number) {
    const row = this.rows.get(id);
    if (!row || !this.isDue(row, now)) return false;
    this.patch(id, { status: 'uploading', lastAttemptAt: now, updatedAt: now });
    return true;
  }

  async markSynced(id: string, remoteId: string, replayed: boolean, now: number) {
    if (this.get(id).status !== 'uploading') return;
    this.patch(id, { status: 'synced', remoteId, remoteReplayed: replayed, errorMessage: null, nextAttemptAt: null, updatedAt: now });
  }

  async markFailed(id: string, update: FailureUpdate, now: number) {
    if (this.get(id).status !== 'uploading') return;
    this.patch(id, { status: 'failed', ...update, updatedAt: now });
  }

  async recoverInterrupted(now: number) {
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.status === 'uploading') {
        this.patch(row.id, { status: 'queued', updatedAt: now });
        count += 1;
      }
    }
    return count;
  }

  async resetForManualRetry(id: string, now: number) {
    if (this.get(id).status !== 'failed') return false;
    this.patch(id, { status: 'queued', retryCount: 0, nextAttemptAt: null, updatedAt: now });
    return true;
  }
}

export class FakeNetwork implements NetworkMonitor {
  private listeners = new Set<(online: boolean) => void>();
  constructor(public online = true) {}

  async isOnline() {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void) {
    this.listeners.add(listener);
    listener(this.online); // NetInfo also reports the current state on subscribe
    return () => {
      this.listeners.delete(listener);
    };
  }

  set(online: boolean) {
    this.online = online;
    this.listeners.forEach((listener) => listener(online));
  }
}

export function fakeApi(impl?: (d: Delivery) => Promise<UploadResult>) {
  const uploadDelivery = jest.fn(
    impl ?? (async (d: Delivery) => ({ remoteId: `srv_${d.id}`, replayed: false })),
  );
  const api: DeliveryApi = { uploadDelivery };
  return { api, uploadDelivery };
}

export function makeDeps(overrides: Partial<SyncDeps> = {}) {
  const store = new FakeStore();
  const network = new FakeNetwork();
  const { api, uploadDelivery } = fakeApi();
  const clock = { now: 1_000_000 };
  const deps: SyncDeps = { store, api, network, clock: () => clock.now, ...overrides };
  return { deps, store, network, uploadDelivery, clock };
}
