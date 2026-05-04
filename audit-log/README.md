# @acegalaxy/audit-log

Cross-project append-only JSONL audit logger. One JSON line per record. Errors are swallowed + logged to stderr — audit MUST NOT break the main flow.

Extracted 2026-04-28 from `db-gateway`, `ott-gateway`, `voice-gateway` audit loggers (3 near-identical implementations).

## Install

Workspace `package.json`:

```json
{
  "dependencies": {
    "@acegalaxy/audit-log": "file:../../ace_commons/audit-log-nodejs"
  }
}
```

## Usage

```js
const path = require("path");
const { createAuditLogger } = require("@acegalaxy/audit-log");

const audit = createAuditLogger({
  logPath: path.join(__dirname, "audit.log"),
  tag: "my-gateway audit",
  mode: "sync",  // or "async" — defaults to "sync"
});

await audit.record({
  ts: new Date().toISOString(),
  outcome: "ok",
  service: "my-gateway",
  // ... any JSON-serializable fields
});

console.log(audit.LOG_PATH);  // resolved absolute path
```

## API

### `createAuditLogger(opts) → AuditLogger`

- **opts.logPath** (string, required) — absolute path to audit log file.
- **opts.tag** (string, required) — stderr prefix used when append fails (e.g. `"db-gateway audit"`).
- **opts.mode** (`"sync"` | `"async"`, default `"sync"`) — sync uses `fs.appendFileSync` (faster, blocks event loop briefly); async uses `fs/promises.appendFile`.

Returns:

- **record(record)** → `Promise<void>` — append one JSON line. Never throws.
- **LOG_PATH** (string) — the resolved log path (echoes back `opts.logPath`).

## Backward-compat shim

Each gateway's `audit/logger.js` becomes a thin wrapper:

```js
// db-gateway/audit/logger.js
const path = require("path");
const { createAuditLogger } = require("@acegalaxy/audit-log");

const logger = createAuditLogger({
  logPath: path.join(__dirname, "audit.log"),
  tag: "db-gateway audit",
});

module.exports = { record: logger.record, LOG_PATH: logger.LOG_PATH };
```

Existing callers `require("./audit/logger").record(...)` continue to work unchanged.

## Why a shared lib?

3 gateways (db, ott, voice) had identical audit logger code (~25 LoC each). Bug fix in one needs PR to all 3. After extraction: 1 shared lib + 3 thin shims. Single source of truth for security-critical L5 (audit) layer.
