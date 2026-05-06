"use strict";

// security-utils-nodejs — security/trust layer primitives for ace_commons gateways.
//
// Bundles 4 small libs that share the same domain (service-to-service trust):
//   - audit-log         (L5 forensics — append-only JSONL)             [CJS]
//   - caller-validator  (L2 authz — {service, scope} contract)         [CJS]
//   - rate-limit        (L4 DoS guard — sliding window + replay guard) [CJS]
//   - vault-loader      (Notion-backed secret loader with TTL cache)   [ESM]
//
// Each sub-module is reachable directly via subpath export:
//   require("@acegalaxy/security-utils/audit-log")
//   require("@acegalaxy/security-utils/caller-validator")
//   require("@acegalaxy/security-utils/rate-limit")
//   import { VaultLoader } from "@acegalaxy/security-utils/vault-loader"  // ESM only
//
// vault-loader is NOT re-exported from the root (this file) because it is ESM
// and the root index is CJS. Consumers must use the ESM subpath import above.

// CommonJS interop preserved via module.exports below — TS can't `export =`
// a spread of imported modules due to private-name re-export limitations.
const auditLog = require("./audit-log");
const callerValidator = require("./caller-validator");
const rateLimit = require("./rate-limit");

module.exports = {
  ...auditLog,
  ...callerValidator,
  ...rateLimit,
  auditLog,
  callerValidator,
  rateLimit,
};