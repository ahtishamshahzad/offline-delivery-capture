# 0005 — Zero-dependency Node mock server, base64 JSON uploads

**Status:** Accepted · 2026-09-30

## Context
No backend was provided. The demo needs real HTTP, so that airplane mode genuinely blocks uploads; real idempotency that survives app kills; and controllable failures. All of this had to fit a 4–6 hour budget.

## Decision
- `mock-server/server.js` uses only Node's `http`, `fs` and `crypto`. It persists to `mock-server/data/db.json` (gitignored), writing atomically via a temp file and rename.
- The photo travels as base64 inside the JSON body (compressed JPEG, about 200 KB).
- Failures are simulated per request through dev-only headers: `X-Simulate-Failure: server_error | malformed | timeout` and `X-Simulate-Delay-Ms`.
- The server stops holding a delayed or timed-out response once the client disconnects.

## Consequences
- `npm run server` needs no install and no config.
- The server stores the delivery before responding, which reproduces "the server got it, the client never saw the reply" for the kill and timeout scenarios.
- Base64 adds about 33% payload overhead. That's acceptable at this photo size, and listed as a production trade-off.

## Alternatives rejected
- **Express / json-server:** dependencies for three routes, and json-server has no idempotency semantics.
- **An in-app mock `DeliveryApi`:** airplane mode would not affect it, and its idempotency store would die with the app.
- **Multipart upload:** it would need a parser in a dependency-free server.
