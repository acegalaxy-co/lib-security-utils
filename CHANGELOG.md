# Changelog

All notable changes to @acegalaxy/lib-security-utils will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-09-24

### Changed
- **BREAKING**: renamed package `@acegalaxy/security-utils` → `@acegalaxy/lib-security-utils`;
  repo renamed `ace_commons-security-utils-nodejs` → `lib-security-utils`. No longer published
  to npm — consumed as a private git-dependency: `github:acegalaxy-co/lib-security-utils#v0.3.0`.
- Synced from Nexus `commons/db-gateway/lib/{audit-log,caller-validator,rate-limit}`
  (audit-log and rate-limit are byte-identical to `commons/ott-gateway/lib/`). Behavior
  unchanged from the Nexus in-repo version; packaged as a standalone private git-dependency.
- `node_modules/` untracked from git.

## [0.2.0] - 2026-05-07

### Removed (BREAKING)
- `vault-loader` subpath extracted into a standalone package: `@acegalaxy/notion-vault`.
- `require("@acegalaxy/security-utils/vault-loader")` no longer works — migrate to
  `require("@acegalaxy/notion-vault")`.

### Changed
- Description / keywords updated to reflect 3-in-1 scope (audit-log + caller-validator +
  rate-limit).

## [0.1.0] - 2026-05-06

### Added
- Initial public release.
- 4-in-1 security primitives (audit-log + caller-validator + rate-limit + vault-loader).
- TypeScript source with `.d.ts` declarations shipped in `dist/`.
- MIT license.

### Changed
- Brief npm scope experiment (`@acegalaxy/*` → `@kanelr/*`) reverted back to
  `@acegalaxy/*` (npm Free org unlimited public packages made the move unnecessary).

[Unreleased]: https://github.com/acegalaxy-co/lib-security-utils/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/acegalaxy-co/lib-security-utils/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/acegalaxy-co/lib-security-utils/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/acegalaxy-co/lib-security-utils/releases/tag/v0.1.0
