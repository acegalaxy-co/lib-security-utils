# @acegalaxy/security-utils

[![npm version](https://img.shields.io/npm/v/@acegalaxy%2Fsecurity-utils.svg)](https://www.npmjs.com/package/@acegalaxy/security-utils)
[![npm downloads](https://img.shields.io/npm/dm/@acegalaxy%2Fsecurity-utils.svg)](https://www.npmjs.com/package/@acegalaxy/security-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/node/v/@acegalaxy%2Fsecurity-utils.svg)](https://nodejs.org)


> 4-in-1 security primitives for Node.js services — rate-limit, audit-log, caller-validator, vault-loader.

Extracted from production gateways (`db-gateway`, `ott-gateway`, `voice-gateway`) at ACE Galaxy. Battle-tested, opinionated defaults, zero heavy deps.

## Install

```bash
npm install @acegalaxy/security-utils
```

Requires Node.js >= 20.

## Subpath exports

| Subpath | Layer | Purpose |
|---|---|---|
| `@acegalaxy/security-utils/audit-log` | L5 forensics | Append-only JSONL logger. Never throws. |
| `@acegalaxy/security-utils/caller-validator` | L2 authz | Enforce `{service, scope}` contract on resolved callers. |
| `@acegalaxy/security-utils/rate-limit` | L4 DoS guard | Sliding-window limiter + TTL replay-guard. In-memory. |
| `@acegalaxy/security-utils/vault-loader` | L1 secrets | Load secrets from a Notion DB into `process.env`. See [vault-loader/README.md](./vault-loader/README.md). |

## Quick start

### audit-log

```js
import { createAuditLogger } from "@acegalaxy/security-utils/audit-log";

const audit = createAuditLogger({ file: "/var/log/app/audit.jsonl" });
audit.log({ event: "login", actor: "user:42", ok: true });
```

### caller-validator

```js
import { createCallerValidator } from "@acegalaxy/security-utils/caller-validator";

const validate = createCallerValidator({
  allow: [{ service: "ott-gateway", scope: "send" }],
});
validate({ service: "ott-gateway", scope: "send" }); // ok
validate({ service: "rogue", scope: "send" });       // throws
```

### rate-limit

```js
import { createSlidingWindow, createReplayGuard } from "@acegalaxy/security-utils/rate-limit";

const limiter = createSlidingWindow({ windowMs: 60_000, max: 30 });
if (!limiter.allow("ip:1.2.3.4")) throw new Error("429");

const replay = createReplayGuard({ ttlMs: 5 * 60_000 });
if (!replay.accept(nonce)) throw new Error("replay");
```

### vault-loader

```js
import { loadVault } from "@acegalaxy/security-utils/vault-loader";

await loadVault({ project: "nexus" }); // hydrates process.env from Notion DB
```

See [vault-loader/README.md](./vault-loader/README.md) for full details (env file fallback, caching, row schema).

## Why bundle?

All 4 modules belong to the same domain (service-trust / secret hygiene) and tend to evolve together. Single repo = single PR = single review. Each subpath is independently importable for tree-shaking.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues: please follow [SECURITY.md](./SECURITY.md).

## License

MIT — see [LICENSE](./LICENSE).
