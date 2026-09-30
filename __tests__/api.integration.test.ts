/**
 * @jest-environment node
 *
 * Real HttpDeliveryApi against the real mock server (in-process, random port).
 * Only the device-specific photo read, the timeout constant and the fetch
 * transport (see test-support/nodeFetch.ts) are replaced.
 */
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { HttpDeliveryApi } from '@/services/api';
import { SyncEngine } from '@/sync/SyncEngine';
import {
  MalformedResponseError,
  PhotoMissingError,
  ServerError,
  TimeoutError,
} from '@/utils/errors';

import { makeDeps } from '../test-support/fakes';
import { nodeFetch } from '../test-support/nodeFetch';

jest.mock('@/config', () => ({ API_URL: null, UPLOAD_TIMEOUT_MS: 300 }));
jest.mock('@/services/photoService', () => ({
  readPhotoBase64: jest.fn(async (relativePath: string) =>
    relativePath.includes('missing') ? null : Buffer.from('fake-jpeg').toString('base64'),
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../mock-server/server') as {
  createServer: (opts: { dataDir: string; log: () => void }) => import('node:http').Server;
};

let server: import('node:http').Server;
let baseUrl: string;
let dataDir: string;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-it-'));
  server = createServer({ dataDir, log: () => {} });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await nodeFetch(`${baseUrl}/deliveries`, { method: 'DELETE' });
});

async function serverCount(): Promise<number> {
  return ((await (await nodeFetch(`${baseUrl}/deliveries`)).json()) as { count: number }).count;
}

function delivery(id: string, photoPath = `photos/${id}.jpg`) {
  const { store } = makeDeps();
  return store.add({ id, photoPath });
}

test('uploads once; re-sending the same idempotency key replays without a duplicate', async () => {
  const api = new HttpDeliveryApi(baseUrl, nodeFetch);
  const d = delivery('a');

  const first = await api.uploadDelivery(d);
  const second = await api.uploadDelivery(d);

  expect(first.replayed).toBe(false);
  expect(second).toEqual({ remoteId: first.remoteId, replayed: true });
  expect(await serverCount()).toBe(1);
});

test('simulated server error maps to ServerError and stores nothing', async () => {
  const api = new HttpDeliveryApi(baseUrl, nodeFetch);
  await expect(
    api.uploadDelivery(delivery('a'), { failureMode: 'server_error', uploadDelayMs: 0 }),
  ).rejects.toBeInstanceOf(ServerError);
  expect(await serverCount()).toBe(0);
});

test('malformed response maps to MalformedResponseError', async () => {
  const api = new HttpDeliveryApi(baseUrl, nodeFetch);
  await expect(
    api.uploadDelivery(delivery('a'), { failureMode: 'malformed', uploadDelayMs: 0 }),
  ).rejects.toBeInstanceOf(MalformedResponseError);
});

test('a slow server maps to TimeoutError', async () => {
  const api = new HttpDeliveryApi(baseUrl, nodeFetch);
  await expect(
    api.uploadDelivery(delivery('a'), { failureMode: 'off', uploadDelayMs: 2000 }),
  ).rejects.toBeInstanceOf(TimeoutError);
});

test('a missing photo file is a PhotoMissingError (no request sent)', async () => {
  const api = new HttpDeliveryApi(baseUrl, nodeFetch);
  await expect(api.uploadDelivery(delivery('a', 'photos/missing.jpg'))).rejects.toBeInstanceOf(
    PhotoMissingError,
  );
  expect(await serverCount()).toBe(0);
});

test('kill during upload: server stored it, app restarts, retry replays → one delivery', async () => {
  // 1. The first attempt reaches the server, but the client never sees the
  //    response (timeout stands in for the app being killed mid-request).
  const api = new HttpDeliveryApi(baseUrl, nodeFetch);
  const { deps, store } = makeDeps({ api });
  const d = store.add({ id: 'a', status: 'uploading' }); // state persisted before the kill
  await expect(api.uploadDelivery(d, { failureMode: 'timeout', uploadDelayMs: 0 })).rejects.toBeInstanceOf(
    TimeoutError,
  );
  expect(await serverCount()).toBe(1);

  // 2. "Relaunch": the engine recovers the stuck row and re-sends it.
  const engine = new SyncEngine(deps);
  await engine.start();
  await engine.whenIdle();
  engine.stop();

  expect(store.get('a')).toMatchObject({ status: 'synced', remoteReplayed: true });
  expect(await serverCount()).toBe(1);
});
