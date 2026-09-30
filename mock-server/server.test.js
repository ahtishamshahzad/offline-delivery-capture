'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, test } = require('node:test');

const { createServer } = require('./server');

let server;
let baseUrl;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-server-test-'));
  server = createServer({ dataDir, log: () => {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/deliveries`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await fetch(baseUrl, { method: 'DELETE' });
});

function payload(overrides = {}) {
  return {
    localId: 'local-1',
    supplierName: 'ABC Materials',
    poNumber: 'PO-1024',
    note: '20 bags of cement',
    createdAt: 1,
    photo: { mimeType: 'image/jpeg', base64: Buffer.from('fake-jpeg').toString('base64') },
    ...overrides,
  };
}

function post(key, body = payload(), headers = {}) {
  return fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...headers },
    body: JSON.stringify(body),
  });
}

async function count() {
  return (await (await fetch(baseUrl)).json()).count;
}

test('first POST creates a delivery', async () => {
  const res = await post('delivery-1');
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.replayed, false);
  assert.match(body.remoteId, /^srv_/);
  assert.equal(await count(), 1);
});

test('same Idempotency-Key replays the original result without a duplicate', async () => {
  const first = await (await post('delivery-1')).json();
  const res = await post('delivery-1');
  assert.equal(res.status, 200);
  const second = await res.json();
  assert.deepEqual(second, { remoteId: first.remoteId, replayed: true });
  assert.equal(await count(), 1);
});

test('a different key creates a separate delivery', async () => {
  await post('delivery-1');
  await post('delivery-2', payload({ localId: 'local-2' }));
  assert.equal(await count(), 2);
});

test('simulated server error returns 503 and stores nothing', async () => {
  const res = await post('delivery-1', payload(), { 'X-Simulate-Failure': 'server_error' });
  assert.equal(res.status, 503);
  assert.equal(await count(), 0);
});

test('simulated malformed response still stores, so a later retry replays', async () => {
  const res = await post('delivery-1', payload(), { 'X-Simulate-Failure': 'malformed' });
  assert.equal(res.status, 200);
  await assert.rejects(res.json());
  assert.equal(await count(), 1);
  const retry = await (await post('delivery-1')).json();
  assert.equal(retry.replayed, true);
  assert.equal(await count(), 1);
});

test('same key with a different payload is rejected with 422', async () => {
  await post('delivery-1');
  const res = await post('delivery-1', payload({ supplierName: 'Someone Else' }));
  assert.equal(res.status, 422);
  assert.equal(await count(), 1);
});

test('invalid body is rejected with 400', async () => {
  const res = await post('delivery-1', payload({ supplierName: '' }));
  assert.equal(res.status, 400);
  assert.equal(await count(), 0);
});

test('missing Idempotency-Key is rejected with 400', async () => {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload()),
  });
  assert.equal(res.status, 400);
});
