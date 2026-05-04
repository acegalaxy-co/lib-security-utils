// Unit tests for VaultLoader.fromBootstrap factory.
//
// SAFETY: tests use FAKE tokens (prefix 'fake-'). No real secrets.
// Tests assert that logger output NEVER contains full token strings —
// rule rules/system/00-secrets-no-printout.md (P0).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VaultLoader } from '../vault-loader/index.js';
import { NotionClient } from '../vault-loader/notion-client.js';

// ---- helpers --------------------------------------------------------------

function makeBootstrapRow({ name, tokenLocal = '', tokenProd = '', dbsLocal = '', dbsProd = '', active = true }) {
  const props = {
    Name: { title: [{ plain_text: name }] },
    reader_token_local: { rich_text: tokenLocal ? [{ plain_text: tokenLocal }] : [] },
    reader_token_prod: { rich_text: tokenProd ? [{ plain_text: tokenProd }] : [] },
    dbs_local: { rich_text: dbsLocal ? [{ plain_text: dbsLocal }] : [] },
    dbs_prod: { rich_text: dbsProd ? [{ plain_text: dbsProd }] : [] },
    active: { checkbox: active },
  };
  return { id: `id-${name}`, properties: props };
}

// Fixed fake token strings used to assert masking
const NEXUS_LOCAL_TOK = 'fake-nexus-local-token-xxxxxxxxxxxxxxxxxxxxxxxx';
const NEXUS_PROD_TOK  = 'fake-nexus-prod-token-yyyyyyyyyyyyyyyyyyyyyyyyy';
const FW_LOCAL_TOK    = 'fake-framework-local-token-zzzzzzzzzzzzzzzzzzzzz';
const FW_PROD_TOK     = 'fake-framework-prod-token-wwwwwwwwwwwwwwwwwwwwww';

const NEXUS_DBS_LOCAL = JSON.stringify({ nexus: 'db-nexus-local', _reminders: 'db-rem-local' });
const NEXUS_DBS_PROD  = JSON.stringify({ nexus: 'db-nexus-prod',  _reminders: 'db-rem-prod' });
const FW_DBS_LOCAL    = JSON.stringify({ framework: 'db-fw-local' });
const FW_DBS_PROD     = JSON.stringify({ framework: 'db-fw-prod' });
const SHARED_LOCAL    = JSON.stringify({ shared_infra: 'db-si-local', bots_write: 'db-bw-local' });
const SHARED_PROD     = JSON.stringify({ shared_infra: 'db-si-prod',  bots_write: 'db-bw-prod' });

const fixtureRows = [
  makeBootstrapRow({
    name: 'nexus',
    tokenLocal: NEXUS_LOCAL_TOK,
    tokenProd: NEXUS_PROD_TOK,
    dbsLocal: NEXUS_DBS_LOCAL,
    dbsProd: NEXUS_DBS_PROD,
  }),
  makeBootstrapRow({
    name: 'framework',
    tokenLocal: FW_LOCAL_TOK,
    tokenProd: FW_PROD_TOK,
    dbsLocal: FW_DBS_LOCAL,
    dbsProd: FW_DBS_PROD,
  }),
  makeBootstrapRow({
    name: '_shared_dbs',
    dbsLocal: SHARED_LOCAL,
    dbsProd: SHARED_PROD,
  }),
];

/**
 * Stub NotionClient.prototype.queryDatabase to return fixture rows for
 * the bootstrap DB id. Returns a restore() function.
 */
function stubNotionClient(rowsByDbId) {
  const orig = NotionClient.prototype.queryDatabase;
  NotionClient.prototype.queryDatabase = async function (dbId) {
    if (rowsByDbId[dbId]) return rowsByDbId[dbId];
    return [];
  };
  return () => { NotionClient.prototype.queryDatabase = orig; };
}

/**
 * Capture logger that records all info/warn/error calls as plain strings.
 */
function makeCaptureLogger() {
  const calls = [];
  const push = (level) => (...args) => calls.push({ level, msg: args.map(String).join(' ') });
  return {
    calls,
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    /** @returns {string} all captured output joined */
    text() { return calls.map((c) => c.msg).join('\n'); },
  };
}

// ---- tests ----------------------------------------------------------------

test('fromBootstrap: project=nexus env=LOCAL returns loader with merged dbs', async () => {
  const restore = stubNotionClient({ 'boot-db': fixtureRows });
  try {
    const logger = makeCaptureLogger();
    const loader = await VaultLoader.fromBootstrap({
      bootstrapToken: 'fake-bootstrap-token',
      bootstrapDbId: 'boot-db',
      project: 'nexus',
      env: 'LOCAL',
      logger,
    });
    assert.ok(loader instanceof VaultLoader);
    // Project DBs must be present
    assert.equal(loader.databases.nexus, 'db-nexus-local');
    assert.equal(loader.databases._reminders, 'db-rem-local');
    // Shared DBs merged in
    assert.equal(loader.databases.shared_infra, 'db-si-local');
    assert.equal(loader.databases.bots_write, 'db-bw-local');
    // Framework DBs must NOT leak
    assert.equal(loader.databases.framework, undefined);
  } finally {
    restore();
  }
});

test('fromBootstrap: env=PROD picks reader_token_prod and dbs_prod', async () => {
  const restore = stubNotionClient({ 'boot-db': fixtureRows });
  try {
    const loader = await VaultLoader.fromBootstrap({
      bootstrapToken: 'fake-bootstrap-token',
      bootstrapDbId: 'boot-db',
      project: 'nexus',
      env: 'PROD',
      logger: makeCaptureLogger(),
    });
    // Internal NotionClient should hold the PROD token
    assert.equal(loader.client.token, NEXUS_PROD_TOK);
    // PROD dbs present
    assert.equal(loader.databases.nexus, 'db-nexus-prod');
    assert.equal(loader.databases.shared_infra, 'db-si-prod');
    // LOCAL dbs absent
    assert.equal(loader.databases._reminders, 'db-rem-prod');
  } finally {
    restore();
  }
});

test('fromBootstrap: env case-insensitive (lowercase "local" works)', async () => {
  const restore = stubNotionClient({ 'boot-db': fixtureRows });
  try {
    const loader = await VaultLoader.fromBootstrap({
      bootstrapToken: 'fake-bootstrap-token',
      bootstrapDbId: 'boot-db',
      project: 'nexus',
      env: 'local',
      logger: makeCaptureLogger(),
    });
    assert.equal(loader.client.token, NEXUS_LOCAL_TOK);
  } finally {
    restore();
  }
});

test('fromBootstrap: missing project throws clear error', async () => {
  const restore = stubNotionClient({ 'boot-db': fixtureRows });
  try {
    await assert.rejects(
      () => VaultLoader.fromBootstrap({
        bootstrapToken: 'fake-bootstrap-token',
        bootstrapDbId: 'boot-db',
        project: 'foo',
        env: 'LOCAL',
        logger: makeCaptureLogger(),
      }),
      /project 'foo' not found in bootstrap DB/,
    );
  } finally {
    restore();
  }
});

test('fromBootstrap: missing token field for env throws clear error', async () => {
  // nexus row with prod token blank
  const rows = [
    makeBootstrapRow({
      name: 'nexus',
      tokenLocal: NEXUS_LOCAL_TOK,
      tokenProd: '', // blank!
      dbsLocal: NEXUS_DBS_LOCAL,
      dbsProd: NEXUS_DBS_PROD,
    }),
  ];
  const restore = stubNotionClient({ 'boot-db': rows });
  try {
    await assert.rejects(
      () => VaultLoader.fromBootstrap({
        bootstrapToken: 'fake-bootstrap-token',
        bootstrapDbId: 'boot-db',
        project: 'nexus',
        env: 'PROD',
        logger: makeCaptureLogger(),
      }),
      /row 'nexus' missing reader_token_prod/,
    );
  } finally {
    restore();
  }
});

test('fromBootstrap: invalid JSON in dbs_local throws clear error', async () => {
  const rows = [
    makeBootstrapRow({
      name: 'nexus',
      tokenLocal: NEXUS_LOCAL_TOK,
      dbsLocal: '{not-json',
    }),
  ];
  const restore = stubNotionClient({ 'boot-db': rows });
  try {
    await assert.rejects(
      () => VaultLoader.fromBootstrap({
        bootstrapToken: 'fake-bootstrap-token',
        bootstrapDbId: 'boot-db',
        project: 'nexus',
        env: 'LOCAL',
        logger: makeCaptureLogger(),
      }),
      /dbs_local not valid JSON/,
    );
  } finally {
    restore();
  }
});

test('fromBootstrap: inactive rows skipped', async () => {
  const rows = [
    makeBootstrapRow({
      name: 'nexus',
      tokenLocal: NEXUS_LOCAL_TOK,
      dbsLocal: NEXUS_DBS_LOCAL,
      active: false, // inactive
    }),
  ];
  const restore = stubNotionClient({ 'boot-db': rows });
  try {
    await assert.rejects(
      () => VaultLoader.fromBootstrap({
        bootstrapToken: 'fake-bootstrap-token',
        bootstrapDbId: 'boot-db',
        project: 'nexus',
        env: 'LOCAL',
        logger: makeCaptureLogger(),
      }),
      /project 'nexus' not found in bootstrap DB/,
    );
  } finally {
    restore();
  }
});

test('fromBootstrap: works without _shared_dbs row (no merge)', async () => {
  const rows = [
    makeBootstrapRow({
      name: 'nexus',
      tokenLocal: NEXUS_LOCAL_TOK,
      dbsLocal: NEXUS_DBS_LOCAL,
    }),
  ];
  const restore = stubNotionClient({ 'boot-db': rows });
  try {
    const loader = await VaultLoader.fromBootstrap({
      bootstrapToken: 'fake-bootstrap-token',
      bootstrapDbId: 'boot-db',
      project: 'nexus',
      env: 'LOCAL',
      logger: makeCaptureLogger(),
    });
    assert.equal(loader.databases.nexus, 'db-nexus-local');
    assert.equal(loader.databases.shared_infra, undefined);
  } finally {
    restore();
  }
});

test('fromBootstrap: project keys override shared on collision', async () => {
  const rows = [
    makeBootstrapRow({
      name: 'nexus',
      tokenLocal: NEXUS_LOCAL_TOK,
      dbsLocal: JSON.stringify({ shared_infra: 'project-override' }),
    }),
    makeBootstrapRow({
      name: '_shared_dbs',
      dbsLocal: JSON.stringify({ shared_infra: 'shared-original' }),
    }),
  ];
  const restore = stubNotionClient({ 'boot-db': rows });
  try {
    const loader = await VaultLoader.fromBootstrap({
      bootstrapToken: 'fake-bootstrap-token',
      bootstrapDbId: 'boot-db',
      project: 'nexus',
      env: 'LOCAL',
      logger: makeCaptureLogger(),
    });
    assert.equal(loader.databases.shared_infra, 'project-override');
  } finally {
    restore();
  }
});

test('fromBootstrap: logger NEVER prints full token (P0 secrets-no-printout)', async () => {
  const restore = stubNotionClient({ 'boot-db': fixtureRows });
  try {
    const logger = makeCaptureLogger();
    await VaultLoader.fromBootstrap({
      bootstrapToken: 'fake-bootstrap-token',
      bootstrapDbId: 'boot-db',
      project: 'nexus',
      env: 'LOCAL',
      logger,
    });
    const out = logger.text();
    // CRITICAL: no full token leaked anywhere in logger output
    assert.equal(out.includes(NEXUS_LOCAL_TOK), false, 'full LOCAL token must NOT appear in log');
    assert.equal(out.includes(NEXUS_PROD_TOK), false, 'full PROD token must NOT appear in log');
    assert.equal(out.includes(FW_LOCAL_TOK), false, 'framework token must NOT appear in log');
    assert.equal(out.includes('fake-bootstrap-token'), false, 'bootstrap token must NOT appear in log');
    // Loader meta line should be present and informative
    assert.match(out, /project=nexus env=LOCAL dbCount=\d+/);
  } finally {
    restore();
  }
});

test('fromBootstrap: missing required args throws', async () => {
  await assert.rejects(
    () => VaultLoader.fromBootstrap({ bootstrapDbId: 'x', project: 'nexus', env: 'LOCAL' }),
    /bootstrapToken required/,
  );
  await assert.rejects(
    () => VaultLoader.fromBootstrap({ bootstrapToken: 't', project: 'nexus', env: 'LOCAL' }),
    /bootstrapDbId required/,
  );
  await assert.rejects(
    () => VaultLoader.fromBootstrap({ bootstrapToken: 't', bootstrapDbId: 'x', env: 'LOCAL' }),
    /project required/,
  );
  await assert.rejects(
    () => VaultLoader.fromBootstrap({ bootstrapToken: 't', bootstrapDbId: 'x', project: 'nexus' }),
    /env required/,
  );
  await assert.rejects(
    () => VaultLoader.fromBootstrap({
      bootstrapToken: 't', bootstrapDbId: 'x', project: 'nexus', env: 'STAGING',
    }),
    /env must be 'LOCAL' or 'PROD'/,
  );
});
