# @zoom-dialer/shared-protocol

Language-neutral IPC protocol contracts for Zoom Dialer Companion.

## Source of truth

JSON Schema documents under [`schema/`](schema/) are authoritative.

- TypeScript types are generated from those schemas into `src/generated/` during `npm run generate`.
- Constants (`PROTOCOL_VERSION`, timeouts, message names, error codes) are loaded from [`schema/protocol.constants.json`](schema/protocol.constants.json).
- Future C# models should be generated from the same schemas; do not re-author envelope fields in app projects.

## What this package is

- Protocol versioning
- Message / success / error envelopes
- Command and event name catalogs
- DTOs and validation interface markers

## What this package is not

- Named-pipe transport
- Serialization engine
- Message dispatcher
- Audio or Electron runtime code

## Scripts

```bash
npm install
npm run generate
npm run build
npm test
```
