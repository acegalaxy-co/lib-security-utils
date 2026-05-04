# @acegalaxy/security-utils

Security/trust layer primitives shared across ace_commons gateways. Bundles 3 small libs that share the same domain — service-to-service trust between gateways and consumers.

| Sub-module | Layer | Purpose |
|---|---|---|
| [`audit-log`](./audit-log/) | L5 forensics | Append-only JSONL logger. Never throws. |
| [`caller-validator`](./caller-validator/) | L2 authz | Enforce `{service, scope}` contract on already-resolved callers. |
| [`rate-limit`](./rate-limit/) | L4 DoS guard | Sliding-window limiter + TTL replay-guard. In-memory. |

Extracted 2026-04-28 from `db-gateway`, `ott-gateway`, `voice-gateway` (replacing 3 stand-alone repos: `audit-log-nodejs`, `caller-validator-nodejs`, `rate-limit-nodejs`).

## Usage

Bundle import:

```js
const { createAuditLogger, createCallerValidator, createSlidingWindow, createReplayGuard } =
  require("../../security-utils-nodejs");
```

Per sub-module (tree-shake-friendly):

```js
const { createAuditLogger } = require("../../security-utils-nodejs/audit-log");
const { createCallerValidator } = require("../../security-utils-nodejs/caller-validator");
const { createSlidingWindow, createReplayGuard } = require("../../security-utils-nodejs/rate-limit");
```

See each sub-module's source file for full API docs.

## Why bundle?

3 libs share the same domain (security/trust) and are updated together. Bug fix in audit log usually correlates with caller-validator log fields and rate-limit deny reasons. Single repo = single PR = single review.

`model-registry-nodejs` is intentionally **not** bundled — different domain (LLM catalog), different change cadence (provider releases vs security audits).
