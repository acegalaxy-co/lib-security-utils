# @kanelr/vault-loader

**Library only.** Load secrets from Notion vault databases into `process.env`.

Supports multi-DB query, project/env filtering, alias expansion (backward compat for `FW_*` / `NEXUS_*` keys), and in-memory TTL cache.

CLI tools live in [`tools/vault-sync/`](../../tools/vault-sync/) (separate package `@kanelr/vault-sync`) — sibling tool that depends on this library to provide `bin/sync-vault.mjs` (atomic file write) + `bin/load-vault.mjs` (stdout/json).

## Setup

Create one or more Notion databases to store your secrets (one DB per project / scope is recommended). Each DB ID + reader integration token is configured via env vars in your local vault config file (e.g. `.env-vault` — git-ignored, chmod 600):

```
# Reader tokens — one per project + per host (LOCAL/PROD)
NOTION_VAULT_<PROJECT>_READER_TOKEN_LOCAL=<notion-token>
NOTION_VAULT_<PROJECT>_READER_TOKEN_PROD=<notion-token>

# DB IDs — one per scope (per-project recommended for least-privilege)
NOTION_VAULT_<PROJECT>_DB_ID=<notion-db-id>
NOTION_VAULT_SHARED_INFRA_DB_ID=<notion-db-id>
NOTION_VAULT_BOTS_WRITE_DB_ID=<notion-db-id>
NOTION_VAULT_SHARED_INFRA_DB_ID=...
NOTION_VAULT_SHARED_CONFIG_DB_ID=...
```

## CLI usage

```bash
# Print stats (counts only, no values)
node bin/load-vault.mjs --stats

# Output as .env format
node bin/load-vault.mjs --project=nexus --env=LOCAL > /tmp/nexus.env

# Output as JSON
node bin/load-vault.mjs --project=framework --env=PROD --json
```

## Library usage

```js
import { VaultLoader, buildDatabasesFromEnv } from '@kanelr/notion-vault-loader';
import { parseEnvFile } from '@kanelr/notion-vault-loader/src/env-file.js';

const envFile = parseEnvFile('/path/to/notion.env');
const loader = new VaultLoader({
  token: envFile.NOTION_VAULT_NEXUS_READER_TOKEN_LOCAL,
  databases: buildDatabasesFromEnv(envFile),
  ttlMs: 10 * 60 * 1000, // 10 min
});

// Load secrets for current process
const secrets = await loader.load({
  projects: ['nexus', 'shared'],
  env: process.env.NODE_ENV === 'production' ? 'PROD' : 'LOCAL',
  injectAliases: true, // expand FW_* / NEXUS_* aliases
});
Object.assign(process.env, secrets);
```

## How filters work

Each row in a vault DB has:

- `env` — multi-select: `PROD`, `LOCAL`, `DEV`, `ALL`
- `project` (or `projects` for shared resources) — which projects use this key
- `category` — `llm`, `notion`, `git`, `infra`, etc.
- `active` — checkbox (rows can be deactivated without deletion)

When you call `load({ projects, env })`:

- `env`: row matches if `row.env` contains the requested env, OR contains `ALL`.
- `projects`: row matches if `row.projects` intersects, OR contains `shared` (which applies to any project).
- `active=false` rows are skipped by default (set `activeOnly: false` to include).

## Alias expansion (backward compatibility)

LLM keys live in `ace-vault-llm` with canonical names like `OPENAI_API_KEY`. The `alias_keys` field lists historical names like `FW_OPENAI_API_KEY, NEXUS_OPENAI_API_KEY` so existing code reading `process.env.FW_OPENAI_API_KEY` keeps working.

Disable with `injectAliases: false` if you only want canonical names.

## Caching

The first call to `load()` or `stats()` queries all DBs once and caches rows for 10 minutes (configurable). Subsequent calls re-filter the cached rows without API calls. Call `invalidateCache()` to force a refetch.

## Testing

```bash
npm test
```

Unit tests stub `NotionClient` so no API calls happen and no real values are exposed.

## Security notes

- The CLI never prints secret values to stderr. `[info]` lines on stderr only show counts.
- `--stats` is safe to log — it returns counts and category breakdowns, never values.
- Reader tokens come from your vault config file (e.g. `.env-vault`) which MUST be git-ignored and chmod 600.
