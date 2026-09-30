// Minimal mock backend for the delivery-capture prototype.
// Zero dependencies: Node's built-in http/fs/crypto only.
//
//   POST   /deliveries   (Idempotency-Key header required)
//   GET    /deliveries   → { count, deliveries }
//   DELETE /deliveries   → reset the store
//
// Dev-only simulation headers:
//   X-Simulate-Failure: server_error | malformed | timeout
//   X-Simulate-Delay-Ms: <ms>   (max 30000)

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MODE_HOLD_MS = 20_000; // longer than the app's 15 s client timeout
const MAX_SIMULATED_DELAY_MS = 30_000;

function createStore(dataDir) {
  const dbFile = path.join(dataDir, 'db.json');
  const photoDir = path.join(dataDir, 'photos');
  fs.mkdirSync(photoDir, { recursive: true });

  /** @type {Record<string, {remoteId: string, payloadHash: string, receivedAt: string, supplierName: string, poNumber: string}>} */
  let records = {};
  if (fs.existsSync(dbFile)) {
    try {
      records = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch {
      records = {};
    }
  }

  function persist() {
    const tmp = `${dbFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
    fs.renameSync(tmp, dbFile); // atomic replace
  }

  return {
    get: (key) => records[key],
    list: () => Object.entries(records).map(([idempotencyKey, r]) => ({ idempotencyKey, ...r })),
    insert(key, record, photoBuffer) {
      fs.writeFileSync(path.join(photoDir, `${record.remoteId}.jpg`), photoBuffer);
      records[key] = record;
      persist();
    },
    reset() {
      records = {};
      persist();
      for (const file of fs.readdirSync(photoDir)) fs.unlinkSync(path.join(photoDir, file));
    },
  };
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Returns an error string, or null when the payload is valid. */
function validate(body) {
  if (typeof body !== 'object' || body === null) return 'Body must be a JSON object';
  const { localId, supplierName, poNumber, note, photo } = body;
  if (typeof localId !== 'string' || !localId) return 'localId is required';
  if (typeof supplierName !== 'string' || !supplierName.trim() || supplierName.length > 100)
    return 'supplierName is required (max 100 chars)';
  if (typeof poNumber !== 'string' || !/^[A-Za-z0-9\-_/ ]{1,40}$/.test(poNumber))
    return 'poNumber is required (max 40 chars, letters/digits/-_/ and spaces)';
  if (note !== undefined && (typeof note !== 'string' || note.length > 500))
    return 'note must be at most 500 chars';
  if (!photo || typeof photo.base64 !== 'string' || !photo.base64) return 'photo.base64 is required';
  return null;
}

function createServer({ dataDir = path.join(__dirname, 'data'), log = console.log } = {}) {
  const store = createStore(dataDir);

  async function handlePost(req, res) {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !key) return sendJson(res, 400, { error: 'Idempotency-Key header is required' });

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (error) {
      return sendJson(res, error.status ?? 400, { error: error.status ? error.message : 'Invalid JSON' });
    }
    const invalid = validate(body);
    if (invalid) return sendJson(res, 400, { error: invalid });

    const failure = req.headers['x-simulate-failure'];
    const delay = Math.min(Number(req.headers['x-simulate-delay-ms']) || 0, MAX_SIMULATED_DELAY_MS);
    if (delay > 0) await sleep(delay);

    if (failure === 'server_error') {
      log(`FAIL   ${key} → 503 (simulated, nothing stored)`);
      return sendJson(res, 503, { error: 'Simulated server error' });
    }

    // Hash everything except the photo bytes' transport encoding differences.
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify([body.localId, body.supplierName, body.poNumber, body.note ?? '', body.photo.base64]))
      .digest('hex');

    // Store (or replay) BEFORE responding: models "server committed, client never saw the reply".
    let record = store.get(key);
    let replayed = true;
    if (record) {
      if (record.payloadHash !== payloadHash) {
        log(`REJECT ${key} → 422 (same key, different payload)`);
        return sendJson(res, 422, { error: 'Idempotency-Key reused with a different payload' });
      }
      log(`REPLAY ${key} → ${record.remoteId}`);
    } else {
      replayed = false;
      record = {
        remoteId: `srv_${crypto.randomUUID()}`,
        payloadHash,
        receivedAt: new Date().toISOString(),
        supplierName: body.supplierName,
        poNumber: body.poNumber,
      };
      store.insert(key, record, Buffer.from(body.photo.base64, 'base64'));
      log(`NEW    ${key} → ${record.remoteId}`);
    }

    if (failure === 'malformed') {
      log(`       ${key} → malformed body (simulated)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"ok":');
    }
    if (failure === 'timeout') {
      log(`       ${key} → holding ${TIMEOUT_MODE_HOLD_MS} ms (simulated timeout)`);
      await sleep(TIMEOUT_MODE_HOLD_MS);
    }
    if (res.destroyed) return; // client gave up (timeout / app killed)
    return sendJson(res, replayed ? 200 : 201, { remoteId: record.remoteId, replayed });
  }

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/deliveries') return sendJson(res, 404, { error: 'Not found' });

    if (req.method === 'POST') {
      handlePost(req, res).catch((error) => {
        log(`ERROR  ${error.stack ?? error}`);
        if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' });
      });
      return;
    }
    if (req.method === 'GET') {
      const deliveries = store.list();
      return sendJson(res, 200, { count: deliveries.length, deliveries });
    }
    if (req.method === 'DELETE') {
      store.reset();
      log('RESET  store cleared');
      return sendJson(res, 200, { count: 0 });
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 4000;
  createServer().listen(port, '0.0.0.0', () => {
    console.log(`Mock delivery API listening on http://0.0.0.0:${port}/deliveries`);
    const lanIps = Object.values(require('node:os').networkInterfaces())
      .flat()
      .filter((net) => net && net.family === 'IPv4' && !net.internal)
      .map((net) => net.address);
    if (lanIps.length) console.log(`Set EXPO_PUBLIC_API_URL to one of: ${lanIps.map((ip) => `http://${ip}:${port}`).join(', ')}`);
  });
}
