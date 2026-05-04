import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRow } from '../vault-loader/row-parser.js';

test('parseRow: basic row with project Select', () => {
  const row = {
    properties: {
      Name: { title: [{ plain_text: 'OPENAI_API_KEY' }] },
      value: { rich_text: [{ plain_text: 'sk-test' }] },
      env: { multi_select: [{ name: 'PROD' }, { name: 'LOCAL' }] },
      project: { select: { name: 'framework' } },
      category: { select: { name: 'llm' } },
      active: { checkbox: true },
      notes: { rich_text: [] },
    },
  };
  const r = parseRow(row);
  assert.equal(r.key, 'OPENAI_API_KEY');
  assert.equal(r.value, 'sk-test');
  assert.deepEqual(r.env, ['PROD', 'LOCAL']);
  assert.deepEqual(r.projects, ['framework']);
  assert.equal(r.category, 'llm');
  assert.equal(r.active, true);
  assert.deepEqual(r.aliases, []);
});

test('parseRow: llm row with multi-select projects + alias_keys', () => {
  const row = {
    properties: {
      Name: { title: [{ plain_text: 'OPENAI_API_KEY' }] },
      value: { rich_text: [{ plain_text: 'sk-test' }] },
      env: { multi_select: [{ name: 'PROD' }, { name: 'LOCAL' }] },
      projects: { multi_select: [{ name: 'framework' }, { name: 'nexus' }] },
      category: { select: { name: 'llm' } },
      provider: { select: { name: 'openai' } },
      alias_keys: { rich_text: [{ plain_text: 'FW_OPENAI_API_KEY, NEXUS_OPENAI_API_KEY' }] },
      active: { checkbox: true },
      notes: { rich_text: [] },
    },
  };
  const r = parseRow(row);
  assert.deepEqual(r.projects, ['framework', 'nexus']);
  assert.deepEqual(r.aliases, ['FW_OPENAI_API_KEY', 'NEXUS_OPENAI_API_KEY']);
  assert.equal(r.provider, 'openai');
});

test('parseRow: missing optional fields return defaults', () => {
  const row = { properties: { Name: { title: [{ plain_text: 'K' }] } } };
  const r = parseRow(row);
  assert.equal(r.key, 'K');
  assert.equal(r.value, '');
  assert.deepEqual(r.env, []);
  assert.deepEqual(r.projects, []);
  assert.equal(r.active, true); // default true when checkbox absent
});

test('parseRow: google DB extra fields (account, scope_type)', () => {
  const row = {
    properties: {
      Name: { title: [{ plain_text: 'GMAIL_TOKEN_KANE' }] },
      value: { rich_text: [{ plain_text: 'oauth-token' }] },
      env: { multi_select: [{ name: 'LOCAL' }] },
      account: { rich_text: [{ plain_text: 'kane' }] },
      scope_type: { select: { name: 'oauth_token' } },
      active: { checkbox: true },
    },
  };
  const r = parseRow(row);
  assert.equal(r.account, 'kane');
  assert.equal(r.scopeType, 'oauth_token');
});
