# Mock server

A stand-in for the real backend: `mock-server/server.js`, Node ≥ 18 with **no dependencies**. Why: [ADR 0005](../architecture/decisions/0005-zero-dependency-mock-server.md). Dev and demo only: no authentication, plain HTTP.

## Run
```bash
npm run server     # listens on 0.0.0.0:4000; prints LAN URLs to use for EXPO_PUBLIC_API_URL
```
| Env var | Purpose |
|---|---|
| `PORT` | Listen port (default `4000`) |

The console logs one line per request: `NEW`, `REPLAY`, `FAIL`, `REJECT` or `RESET`, plus simulated holds. Keep it visible during a demo.

## Docs
| Doc | Contents |
|---|---|
| [api/](api/README.md) | Endpoint reference |

## Storage
- `mock-server/data/db.json` maps `idempotencyKey → { remoteId, payloadHash, receivedAt, supplierName, poNumber }`. It's written atomically (temp file + rename), so it survives restarts.
- `mock-server/data/photos/<remoteId>.jpg` holds the uploaded photos.
- `mock-server/data/` is gitignored. Delete it, or call `DELETE /deliveries`, to reset.

## Tests
`npm run test:server` runs `mock-server/server.test.js` (`node:test`, random port, temp data dir). The mobile app's integration tests also start this server in-process ([testing.md](../testing.md)).
