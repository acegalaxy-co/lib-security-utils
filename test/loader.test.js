// Integration test for VaultLoader with stubbed NotionClient.
// Tests filter logic, alias expansion, multi-project, env=ALL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VaultLoader, buildDatabasesFromEnv } from '../vault-loader/index.js';

function makeRow({ key, value, env = ['PROD', 'LOCAL'], projects = [], project, category = 'other', active = true, aliases = [] }) {
  const props = {
    Name: { title: [{ plain_text: key }] },
    value: { rich_text: [{ plain_text: value }] },
    env: { multi_select: env.map((n) => ({ name: n })) },
    category: { select: { name: category } },
    active: { checkbox: active },
    notes: { rich_text: [] },
  };
  if (projects.length > 0) props.projects = { multi_select: projects.map((p) => ({ name: p })) };
  if (project) props.project = { select: { name: project } };
  if (aliases.length > 0) props.alias_keys = { rich_text: [{ plain_text: aliases.join(', ') }] };
  return { id: `id-${key}`, properties: props };
}

function makeLoader(rowsByDb) {
  const loader = new VaultLoader({
    token: 'fake',
    databases: Object.fromEntries(Object.keys(rowsByDb).map((k) => [k, `db-${k}`])),
  });
  // Stub the client.queryDatabase to return per-DB rows
  loader.client.queryDatabase = async (dbId) => {
    const slug = dbId.replace(/^db-/, '');
    return rowsByDb[slug] || [];
  };
  return loader;
}

test('loader: filter by env=PROD excludes env=LOCAL-only', async () => {
  const loader = makeLoader({
    framework: [
      makeRow({ key: 'A', value: '1', env: ['PROD', 'LOCAL'] }),
      makeRow({ key: 'B', value: '2', env: ['LOCAL'] }),
    ],
  });
  const env = await loader.load({ env: 'PROD' });
  assert.equal(env.A, '1');
  assert.equal(env.B, undefined);
});

test('loader: env=ALL matches all envs', async () => {
  const loader = makeLoader({
    framework: [makeRow({ key: 'A', value: '1', env: ['ALL'] })],
  });
  const prod = await loader.load({ env: 'PROD' });
  const local = await loader.load({ env: 'LOCAL' });
  assert.equal(prod.A, '1');
  assert.equal(local.A, '1');
});

test('loader: project filter — single project', async () => {
  const loader = makeLoader({
    framework: [makeRow({ key: 'FW_X', value: 'a', project: 'framework' })],
    nexus: [makeRow({ key: 'NX_X', value: 'b', project: 'nexus' })],
  });
  const env = await loader.load({ projects: ['nexus'] });
  assert.equal(env.NX_X, 'b');
  assert.equal(env.FW_X, undefined);
});

test('loader: project=shared applies to any project asking', async () => {
  const loader = makeLoader({
    'shared-config': [makeRow({ key: 'REDIS_URL', value: 'redis://x', project: 'shared' })],
    nexus: [makeRow({ key: 'NX_X', value: 'b', project: 'nexus' })],
  });
  const env = await loader.load({ projects: ['nexus'] });
  assert.equal(env.REDIS_URL, 'redis://x');
  assert.equal(env.NX_X, 'b');
});

test('loader: multi-select projects matches if intersect', async () => {
  const loader = makeLoader({
    llm: [makeRow({ key: 'OPENAI_API_KEY', value: 'sk', projects: ['framework', 'nexus'] })],
  });
  const fwEnv = await loader.load({ projects: ['framework'] });
  const nxEnv = await loader.load({ projects: ['nexus'] });
  const otherEnv = await loader.load({ projects: ['ott-gateway'] });
  assert.equal(fwEnv.OPENAI_API_KEY, 'sk');
  assert.equal(nxEnv.OPENAI_API_KEY, 'sk');
  assert.equal(otherEnv.OPENAI_API_KEY, undefined);
});

test('loader: alias expansion injects all alias_keys', async () => {
  const loader = makeLoader({
    llm: [
      makeRow({
        key: 'OPENAI_API_KEY',
        value: 'sk-canonical',
        projects: ['framework', 'nexus'],
        aliases: ['FW_OPENAI_API_KEY', 'NEXUS_OPENAI_API_KEY'],
      }),
    ],
  });
  const env = await loader.load({ projects: ['framework'], injectAliases: true });
  assert.equal(env.OPENAI_API_KEY, 'sk-canonical');
  assert.equal(env.FW_OPENAI_API_KEY, 'sk-canonical');
  assert.equal(env.NEXUS_OPENAI_API_KEY, 'sk-canonical');
});

test('loader: --no-aliases skips alias expansion', async () => {
  const loader = makeLoader({
    llm: [
      makeRow({
        key: 'OPENAI_API_KEY',
        value: 'sk',
        projects: ['framework'],
        aliases: ['FW_OPENAI_API_KEY'],
      }),
    ],
  });
  const env = await loader.load({ projects: ['framework'], injectAliases: false });
  assert.equal(env.OPENAI_API_KEY, 'sk');
  assert.equal(env.FW_OPENAI_API_KEY, undefined);
});

test('loader: activeOnly excludes inactive rows', async () => {
  const loader = makeLoader({
    framework: [
      makeRow({ key: 'A', value: '1', active: true }),
      makeRow({ key: 'B', value: '2', active: false }),
    ],
  });
  const env = await loader.load({ activeOnly: true });
  assert.equal(env.A, '1');
  assert.equal(env.B, undefined);
});

test('loader: cache reused on second load', async () => {
  let queryCount = 0;
  const loader = new VaultLoader({ token: 'fake', databases: { framework: 'db-framework' } });
  loader.client.queryDatabase = async () => {
    queryCount++;
    return [makeRow({ key: 'A', value: '1' })];
  };
  await loader.load();
  await loader.load();
  assert.equal(queryCount, 1, 'second load should hit cache');
});

test('loader: invalidateCache forces refetch', async () => {
  let queryCount = 0;
  const loader = new VaultLoader({ token: 'fake', databases: { framework: 'db-framework' } });
  loader.client.queryDatabase = async () => {
    queryCount++;
    return [makeRow({ key: 'A', value: '1' })];
  };
  await loader.load();
  loader.invalidateCache();
  await loader.load();
  assert.equal(queryCount, 2);
});

test('loader: stats returns counts not values', async () => {
  const loader = makeLoader({
    llm: [makeRow({ key: 'OPENAI_API_KEY', value: 'sk', category: 'llm', aliases: ['FW_OPENAI_API_KEY'] })],
    framework: [makeRow({ key: 'A', value: '1', category: 'other' })],
  });
  const stats = await loader.stats();
  assert.equal(stats.totalRows, 2);
  assert.equal(stats.totalAliases, 1);
  assert.equal(stats.injectedKeys, 3);
  // No actual values present in stats output
  const j = JSON.stringify(stats);
  assert.equal(j.includes('sk'), false);
});

test('buildDatabasesFromEnv: extracts only valid DB ID entries', () => {
  const envObj = {
    NOTION_VAULT_LLM_DB_ID: 'abc',
    NOTION_VAULT_NEXUS_DB_ID: 'def',
    NOTION_VAULT_OLD_FLAT_DB_ID: 'ghi',
    NOTION_VAULT_CONTAINER_PAGE_ID: 'jkl',
    NOTION_VAULT_NEXUS_READER_TOKEN_LOCAL: 'mno',
    OTHER_KEY: 'pqr',
  };
  const dbs = buildDatabasesFromEnv(envObj);
  assert.equal(dbs.llm, 'abc');
  assert.equal(dbs.nexus, 'def');
  assert.equal(dbs.old_flat, undefined);
  assert.equal(dbs.container_page, undefined);
  assert.equal(dbs.OTHER_KEY, undefined);
});

test('buildDatabasesFromEnv: project=[nexus] excludes FRAMEWORK DB', () => {
  const envObj = {
    NOTION_VAULT_NEXUS_DB_ID: 'nx',
    NOTION_VAULT_FRAMEWORK_DB_ID: 'fw',
    NOTION_VAULT_SHARED_INFRA_DB_ID: 'si',
    NOTION_VAULT_SHARED_CONFIG_DB_ID: 'sc',
    NOTION_VAULT_BOTS_WRITE_DB_ID: 'bw',
    NOTION_VAULT__REMINDERS_DB_ID: 'rm',
  };
  const dbs = buildDatabasesFromEnv(envObj, ['nexus']);
  assert.equal(dbs.nexus, 'nx');
  assert.equal(dbs.framework, undefined, 'framework DB must NOT leak into nexus scope');
  assert.equal(dbs.shared_infra, 'si');
  assert.equal(dbs.shared_config, 'sc');
  assert.equal(dbs.bots_write, 'bw');
  assert.equal(dbs._reminders, 'rm');
});

test('buildDatabasesFromEnv: project=[framework] excludes NEXUS DB', () => {
  const envObj = {
    NOTION_VAULT_NEXUS_DB_ID: 'nx',
    NOTION_VAULT_FRAMEWORK_DB_ID: 'fw',
    NOTION_VAULT_SHARED_INFRA_DB_ID: 'si',
  };
  const dbs = buildDatabasesFromEnv(envObj, ['framework']);
  assert.equal(dbs.framework, 'fw');
  assert.equal(dbs.nexus, undefined, 'nexus DB must NOT leak into framework scope');
  assert.equal(dbs.shared_infra, 'si');
});

test('buildDatabasesFromEnv: empty projects preserves legacy behavior (include all)', () => {
  const envObj = {
    NOTION_VAULT_NEXUS_DB_ID: 'nx',
    NOTION_VAULT_FRAMEWORK_DB_ID: 'fw',
    NOTION_VAULT_SHARED_INFRA_DB_ID: 'si',
  };
  const dbs = buildDatabasesFromEnv(envObj);
  assert.equal(dbs.nexus, 'nx');
  assert.equal(dbs.framework, 'fw');
  assert.equal(dbs.shared_infra, 'si');
});

test('buildDatabasesFromEnv: multi-project includes all matching', () => {
  const envObj = {
    NOTION_VAULT_NEXUS_DB_ID: 'nx',
    NOTION_VAULT_FRAMEWORK_DB_ID: 'fw',
    NOTION_VAULT_OTT_GATEWAY_DB_ID: 'ott',
    NOTION_VAULT_SHARED_INFRA_DB_ID: 'si',
  };
  const dbs = buildDatabasesFromEnv(envObj, ['nexus', 'framework']);
  assert.equal(dbs.nexus, 'nx');
  assert.equal(dbs.framework, 'fw');
  assert.equal(dbs.ott_gateway, undefined, 'ott_gateway must be excluded');
  assert.equal(dbs.shared_infra, 'si');
});
