# Deliveries

The only contract between the mobile app and the server. Client: `HttpDeliveryApi` in `src/services/api.ts`.

## `POST /deliveries`: upload a delivery (idempotent)

**Headers**
| Header | Required | Meaning |
|---|---|---|
| `Content-Type: application/json` | ✅ | |
| `Idempotency-Key` | ✅ | `delivery-<uuid>`, stable for the delivery's lifetime |
| `X-Simulate-Failure` | dev | `server_error` · `malformed` · `timeout` |
| `X-Simulate-Delay-Ms` | dev | Wait before handling, max 30 000 |

**Body**
```json
{
  "localId": "550e8400-…",
  "supplierName": "ABC Materials",
  "poNumber": "PO-1024",
  "note": "20 bags of cement",
  "createdAt": 1790000000000,
  "photo": { "mimeType": "image/jpeg", "base64": "<jpeg bytes>" }
}
```
Validation matches the app: supplier required, ≤ 100 chars; PO required, ≤ 40 chars, `[A-Za-z0-9-_/ ]`; note ≤ 500 chars; photo base64 required. The maximum body size is 10 MB.

**Responses**
| Status | Body | When |
|---|---|---|
| `201` | `{ remoteId, replayed: false }` | First time this key is seen; the delivery is stored |
| `200` | `{ remoteId, replayed: true }` | Key already stored, same payload. **Nothing new is created** |
| `400` | `{ error }` | Missing key, invalid JSON, or validation failure |
| `413` | `{ error }` | Body over 10 MB |
| `422` | `{ error }` | Key already used with a **different** payload |
| `503` | `{ error }` | Simulated server error. **Nothing is stored** |
| `500` | `{ error }` | Unexpected server error |

**Order of handling:** validate → delay → simulated 503 → store or replay → simulated malformed/timeout → respond.
The record is stored **before** the response, so a client that times out or dies still has its delivery on the server, and its retry gets `replayed: true`.

| Simulation | Stored? | Client sees |
|---|---|---|
| `server_error` | No | 503 → `ServerError`, auto retry |
| `malformed` | Yes | 200 with body `{"ok":` → `MalformedResponseError`, auto retry → replay |
| `timeout` | Yes | Response held 20 s (the client gives up at 15 s) → `TimeoutError`, auto retry → replay |
| delay | Yes (after the delay) | Normal response, later. If the client disconnects, the server stops waiting and stores immediately |

## `GET /deliveries`
`200 { count, deliveries: [{ idempotencyKey, remoteId, payloadHash, receivedAt, supplierName, poNumber }] }`. Used by the dev screen's server count.

## `DELETE /deliveries`
`200 { count: 0 }`. Clears all records and photos. Used by **Reset demo data**.

## Example: duplicate submission
```bash
BODY='{"localId":"x","supplierName":"ABC","poNumber":"PO-1","note":"","createdAt":0,"photo":{"mimeType":"image/jpeg","base64":"AA=="}}'
curl -s -X POST localhost:4000/deliveries -H 'Content-Type: application/json' -H 'Idempotency-Key: delivery-demo' -d "$BODY"
# {"remoteId":"srv_…","replayed":false}
curl -s -X POST localhost:4000/deliveries -H 'Content-Type: application/json' -H 'Idempotency-Key: delivery-demo' -d "$BODY"
# {"remoteId":"srv_… (same)","replayed":true}
```
