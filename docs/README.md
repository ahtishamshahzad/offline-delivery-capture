# Documentation

Product documentation for **Delivery Capture**, an offline-first app for recording material deliveries on site. The repository [README](../README.md) is the entry point: it explains the offline strategy, app-kill recovery and duplicate prevention, how to run everything, and a demo script. This tree is the reference behind it: one file per screen, endpoint and decision.

| Application | What it is | Docs |
|---|---|---|
| **Mobile app** | Expo SDK 57 / React Native app (iOS + Android): capture, local SQLite queue, sync engine | [mobile/](mobile/README.md) |
| **Mock server** | Zero-dependency Node HTTP API that stands in for the backend: idempotent uploads, failure simulation | [mock-server/](mock-server/README.md) |

| Cross-application | |
|---|---|
| [architecture/](architecture/README.md) | How the two apps fit together, plus architecture decision records |
| [testing.md](testing.md) | Automated test suites, what they cover, and the on-simulator verification record |

Planning records (plan, gate status, project state) live in [`.ai/`](../.ai/README.md), not here.
