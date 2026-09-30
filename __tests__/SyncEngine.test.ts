import { SyncEngine } from '@/sync/SyncEngine';
import { MAX_AUTO_RETRIES } from '@/sync/retryPolicy';
import { ClientError, ServerError } from '@/utils/errors';

import { fakeApi, makeDeps } from '../test-support/fakes';

let engine: SyncEngine | null = null;

afterEach(() => {
  engine?.stop();
  engine = null;
  jest.useRealTimers();
});

function startEngine(deps: ReturnType<typeof makeDeps>['deps']) {
  engine = new SyncEngine(deps);
  return engine;
}

test('uploads a queued delivery and marks it synced', async () => {
  const { deps, store, uploadDelivery } = makeDeps();
  store.add({ id: 'a' });
  const sync = startEngine(deps);

  await sync.requestSync('created');

  expect(uploadDelivery).toHaveBeenCalledTimes(1);
  expect(uploadDelivery.mock.calls[0][0].idempotencyKey).toBe('delivery-a');
  expect(store.get('a')).toMatchObject({ status: 'synced', remoteId: 'srv_a', errorMessage: null });
});

test('a retryable failure schedules a backoff retry and keeps the row', async () => {
  const { api } = fakeApi(async () => {
    throw new ServerError(503, 'down');
  });
  const { deps, store, clock } = makeDeps({ api });
  store.add({ id: 'a' });

  await startEngine(deps).requestSync('created');

  expect(store.get('a')).toMatchObject({
    status: 'failed',
    retryCount: 1,
    nextAttemptAt: clock.now + 2000,
    errorMessage: 'Server error (503)',
  });
});

test(`after ${MAX_AUTO_RETRIES} failed attempts it stops auto-retrying`, async () => {
  const { api } = fakeApi(async () => {
    throw new ServerError(503, 'down');
  });
  const { deps, store, clock } = makeDeps({ api });
  store.add({ id: 'a', status: 'failed', retryCount: MAX_AUTO_RETRIES - 1, nextAttemptAt: clock.now });

  await startEngine(deps).requestSync('backoff-timer');

  expect(store.get('a')).toMatchObject({ status: 'failed', retryCount: MAX_AUTO_RETRIES, nextAttemptAt: null });
});

test('a permanent (4xx) error needs a manual retry immediately', async () => {
  const { api } = fakeApi(async () => {
    throw new ClientError(400, 'bad');
  });
  const { deps, store } = makeDeps({ api });
  store.add({ id: 'a' });

  await startEngine(deps).requestSync('created');

  expect(store.get('a')).toMatchObject({ status: 'failed', retryCount: 1, nextAttemptAt: null });
});

test('exhausted failures are not picked up automatically', async () => {
  const { deps, store, uploadDelivery } = makeDeps();
  store.add({ id: 'a', status: 'failed', retryCount: MAX_AUTO_RETRIES, nextAttemptAt: null });

  await startEngine(deps).requestSync('reconnect');

  expect(uploadDelivery).not.toHaveBeenCalled();
});

test('concurrent sync requests never upload the same delivery twice', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { api, uploadDelivery } = fakeApi(async (d) => {
    await gate;
    return { remoteId: `srv_${d.id}`, replayed: false };
  });
  const { deps, store } = makeDeps({ api });
  store.add({ id: 'a' });
  store.add({ id: 'b' });
  const sync = startEngine(deps);

  const runs = [sync.requestSync('created'), sync.requestSync('queue-focus'), sync.requestSync('reconnect')];
  release();
  await Promise.all(runs);
  await sync.whenIdle();

  expect(uploadDelivery).toHaveBeenCalledTimes(2);
  expect(uploadDelivery.mock.calls.map(([d]) => d.id)).toEqual(['a', 'b']);
  expect(store.get('a').status).toBe('synced');
  expect(store.get('b').status).toBe('synced');
});

test('start() recovers a delivery left in uploading by a killed app, then syncs it', async () => {
  const { api, uploadDelivery } = fakeApi(async (d) => ({ remoteId: `srv_${d.id}`, replayed: true }));
  const { deps, store } = makeDeps({ api });
  store.add({ id: 'a', status: 'uploading' });

  const sync = startEngine(deps);
  await sync.start();
  await sync.whenIdle();

  expect(uploadDelivery).toHaveBeenCalledTimes(1);
  expect(uploadDelivery.mock.calls[0][0].idempotencyKey).toBe('delivery-a');
  expect(store.get('a')).toMatchObject({ status: 'synced', remoteReplayed: true });
});

test('offline: nothing is uploaded and the delivery stays queued', async () => {
  const { deps, store, network, uploadDelivery } = makeDeps();
  network.online = false;
  store.add({ id: 'a' });

  await startEngine(deps).requestSync('created');

  expect(uploadDelivery).not.toHaveBeenCalled();
  expect(store.get('a').status).toBe('queued');
});

test('going from offline to online triggers a sync automatically', async () => {
  const { deps, store, network, uploadDelivery } = makeDeps();
  network.online = false;
  store.add({ id: 'a' });
  const sync = startEngine(deps);
  await sync.start();
  await sync.whenIdle();
  expect(uploadDelivery).not.toHaveBeenCalled();

  network.set(true);
  await sync.whenIdle();

  expect(uploadDelivery).toHaveBeenCalledTimes(1);
  expect(store.get('a').status).toBe('synced');
});

test('the backoff timer retries a failed delivery when it becomes due', async () => {
  jest.useFakeTimers();
  let fail = true;
  const { api, uploadDelivery } = fakeApi(async (d) => {
    if (fail) throw new ServerError(503, 'down');
    return { remoteId: `srv_${d.id}`, replayed: false };
  });
  const { deps, store, clock } = makeDeps({ api });
  store.add({ id: 'a' });
  const sync = startEngine(deps);

  await sync.requestSync('created');
  expect(store.get('a').status).toBe('failed');

  fail = false;
  clock.now += 2000;
  await jest.advanceTimersByTimeAsync(2000);
  await sync.whenIdle();

  expect(uploadDelivery).toHaveBeenCalledTimes(2);
  expect(store.get('a').status).toBe('synced');
});

test('manual retry resets the backoff state and uploads again', async () => {
  const { deps, store, uploadDelivery } = makeDeps();
  store.add({ id: 'a', status: 'failed', retryCount: MAX_AUTO_RETRIES, nextAttemptAt: null });
  const sync = startEngine(deps);

  await store.resetForManualRetry('a', 0);
  await sync.requestSync('manual');

  expect(uploadDelivery).toHaveBeenCalledTimes(1);
  expect(store.get('a')).toMatchObject({ status: 'synced', retryCount: 0 });
});
