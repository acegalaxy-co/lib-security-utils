import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TTLCache } from '../vault-loader/cache.js';

test('cache: set + get within TTL', () => {
  const c = new TTLCache({ ttlMs: 1000 });
  c.set('k', 'v');
  assert.equal(c.get('k'), 'v');
  assert.equal(c.has('k'), true);
});

test('cache: expired entries return undefined', async () => {
  const c = new TTLCache({ ttlMs: 50 });
  c.set('k', 'v');
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(c.get('k'), undefined);
  assert.equal(c.has('k'), false);
});

test('cache: clear removes all', () => {
  const c = new TTLCache();
  c.set('a', 1);
  c.set('b', 2);
  c.clear();
  assert.equal(c.size(), 0);
});

test('cache: per-entry TTL override', async () => {
  const c = new TTLCache({ ttlMs: 1000 });
  c.set('short', 'v', 50);
  c.set('long', 'v', 1000);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(c.get('short'), undefined);
  assert.equal(c.get('long'), 'v');
});
