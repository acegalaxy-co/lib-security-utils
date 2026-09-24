# @acegalaxy/lib-security-utils

Shared security primitives used across Nexus-family gateways: append-only audit
logging, caller validation (default-deny), sliding-window rate limiting, and a
TTL-based replay guard.

## Install

```json
"dependencies": {
  "@acegalaxy/lib-security-utils": "github:acegalaxy-co/lib-security-utils#v0.3.0"
}
```

For local development against a sibling checkout:

```bash
npm install --no-save ../lib-security-utils
```

## API

### `.` (root) — re-exports all four factories

```ts
import { createAuditLogger, createCallerValidator, createSlidingWindow, createReplayGuard } from "@acegalaxy/lib-security-utils";
```

### `./audit-log`

```ts
createAuditLogger({ logPath: string, tag: string, mode?: "sync" | "async" }): {
  record(rec: Record<string, unknown>): Promise<void>;
  LOG_PATH: string;
}
```

Appends JSONL records to `logPath`. Write failures are swallowed and logged to
stderr — audit logging must never break the main call flow.

### `./caller-validator`

```ts
createCallerValidator(opts?: { extraFields?: string[] }): {
  resolveCaller(caller: unknown): Promise<{ service: string; scope: string; roles: string[] } | null>;
}
```

Default-deny: missing/non-object caller, missing `service`, or missing `scope`
resolves to `null`. Unknown fields are dropped unless whitelisted via
`extraFields`.

### `./rate-limit`

```ts
createSlidingWindow(opts: {
  windowMs: number;
  maxRequests: number;
  keyFn?: (...args: unknown[]) => string;
  reasonOnDeny?: string;
  extraChecks?: Array<(key: string, ...args: unknown[]) => Promise<{ ok: boolean; reason?: string }> | { ok: boolean; reason?: string }>;
}): {
  check(...args: unknown[]): Promise<{ ok: boolean; reason?: string }>;
  reset(): void;
  windowMs: number;
  maxRequests: number;
}

createReplayGuard(opts: { ttlMs: number }): {
  seen(id: string): boolean; // true = duplicate within ttl (refreshes timestamp); false = first time
  reset(): void;
}
```

## Config

No environment variables — all behavior is configured via factory options at
call sites (audit log path, rate-limit windows, TTLs are owned by the
consuming gateway).

## Changelog

- **0.3.0** — renamed from `@acegalaxy/security-utils@0.2.0`, synced from
  Nexus `commons/db-gateway/lib/{audit-log,caller-validator,rate-limit}`
  (audit-log and rate-limit are byte-identical to
  `commons/ott-gateway/lib/`). Behavior unchanged from the Nexus in-repo
  version; packaged as a standalone private git-dependency.

Xem [RESEARCH.md](./RESEARCH.md) cho nguồn research + hướng cải tiến.
