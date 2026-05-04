# @acegalaxy/security-utils

> **NPM commons library** — Security/trust layer primitives: audit-log (L5 forensics) + caller-validator (L2 authz) + rate-limit (L4 DoS guard) + vault-loader (Notion secrets). Bundle of 4 small libs extracted from db/ott/voice gateways.
> Cross-cutting rules: see framework `../../rules/00-index.md`.
> ⭐⭐⭐ **Harness Architecture (P0)**: Mọi feature mới BẮT BUỘC route qua 1 trong 5 surfaces (slash command / hook / subagent / MCP / permission). Đọc `../../rules/meta/02-harness-architecture.md`. KHÔNG add ad-hoc scripts.

## Module purpose

Shared security primitives reused across all gateways. ESM subpath exports per concern; no global state.

## Key files

- `index.js` — entry point (re-exports)
- `audit-log/` — L5 append-only forensics
- `caller-validator/` — L2 authz / allowlist
- `rate-limit/` — L4 token bucket
- `vault-loader/` — Notion secrets reader (`.env-bootstrap` chain)

## Embedded vs imported

Per gateway-mandatory rule: per-project independence — KHÔNG `require()` module này từ project khác. Copy code OK, scope isolation. Use subpath imports (e.g. `./vault-loader`).

## Tests

`npm test` (runs `node --test test/*.test.js`).
