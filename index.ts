"use strict";

// security-utils-nodejs — security/trust layer primitives for ace_commons gateways.
//
// Bundles 3 small libs that share the same domain (service-to-service trust):
//   - audit-log         (L5 forensics — append-only JSONL)             [CJS]
//   - caller-validator  (L2 authz — {service, scope} contract)         [CJS]
//   - rate-limit        (L4 DoS guard — sliding window + replay guard) [CJS]
//
// Each sub-module is reachable directly via subpath export:
//   require("@acegalaxy/security-utils/audit-log")
//   require("@acegalaxy/security-utils/caller-validator")
//   require("@acegalaxy/security-utils/rate-limit")
//
// (vault-loader was extracted into a standalone package: @acegalaxy/notion-vault)

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