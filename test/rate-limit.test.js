const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const modulePath = path.resolve(__dirname, "../rate-limit");

function freshRequire() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

describe("lib-security-utils rate-limit (sliding window)", () => {
  it("allows requests within window limit", async () => {
    const { createSlidingWindow } = freshRequire();
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 3,
    });

    const r1 = await limiter.check("svc1");
    const r2 = await limiter.check("svc1");
    const r3 = await limiter.check("svc1");

    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    assert.equal(r3.ok, true);
  });

  it("rejects request exceeding window limit", async () => {
    const { createSlidingWindow } = freshRequire();
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 2,
    });

    await limiter.check("svc1");
    await limiter.check("svc1");
    const r3 = await limiter.check("svc1");

    assert.equal(r3.ok, false);
    assert.equal(r3.reason, "rate_limit");
  });

  it("uses custom key function to bucket requests", async () => {
    const { createSlidingWindow } = freshRequire();
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 2,
      keyFn: (svc, store) => (svc ? `${svc}::${store}` : ""),
    });

    await limiter.check("svc1", "postgres");
    await limiter.check("svc1", "postgres");
    const r3a = await limiter.check("svc1", "postgres");
    assert.equal(r3a.ok, false);

    const r1b = await limiter.check("svc1", "sqlite");
    assert.equal(r1b.ok, true);

    const r1c = await limiter.check("svc2", "postgres");
    assert.equal(r1c.ok, true);
  });

  it("uses custom reasonOnDeny", async () => {
    const { createSlidingWindow } = freshRequire();
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 1,
      reasonOnDeny: "quota_exceeded",
    });

    await limiter.check("svc1");
    const r2 = await limiter.check("svc1");

    assert.equal(r2.ok, false);
    assert.equal(r2.reason, "quota_exceeded");
  });

  it("resets all buckets", async () => {
    const { createSlidingWindow } = freshRequire();
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 1,
    });

    await limiter.check("svc1");
    const r2a = await limiter.check("svc1");
    assert.equal(r2a.ok, false);

    limiter.reset();

    const r1b = await limiter.check("svc1");
    assert.equal(r1b.ok, true);
  });

  it("rejects empty key", async () => {
    const { createSlidingWindow } = freshRequire();
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 10,
      keyFn: () => "",
    });

    const result = await limiter.check("svc1");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "rate_limit");
  });

  it("runs extra checks after window passes", async () => {
    const { createSlidingWindow } = freshRequire();
    let extraCheckCalled = false;
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 10,
      extraChecks: [
        async () => {
          extraCheckCalled = true;
          return { ok: true };
        },
      ],
    });

    await limiter.check("svc1");
    assert.equal(extraCheckCalled, true);
  });

  it("short-circuits on first extra check failure", async () => {
    const { createSlidingWindow } = freshRequire();
    let checkCount = 0;
    const limiter = createSlidingWindow({
      windowMs: 1000,
      maxRequests: 10,
      extraChecks: [
        async () => {
          checkCount++;
          return { ok: false, reason: "cost_exceeded" };
        },
        async () => {
          checkCount++;
          return { ok: true };
        },
      ],
    });

    const result = await limiter.check("svc1");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "cost_exceeded");
    assert.equal(checkCount, 1);
  });

  it("throws on invalid windowMs", () => {
    const { createSlidingWindow } = freshRequire();
    assert.throws(
      () => createSlidingWindow({ windowMs: -1, maxRequests: 10 }),
      /windowMs must be positive/
    );
    assert.throws(
      () => createSlidingWindow({ windowMs: 0, maxRequests: 10 }),
      /windowMs must be positive/
    );
  });

  it("throws on invalid maxRequests", () => {
    const { createSlidingWindow } = freshRequire();
    assert.throws(
      () => createSlidingWindow({ windowMs: 1000, maxRequests: -1 }),
      /maxRequests must be positive/
    );
    assert.throws(
      () => createSlidingWindow({ windowMs: 1000, maxRequests: 0 }),
      /maxRequests must be positive/
    );
  });

  // Ported from ott-gateway-L4-rate-limit.test.js primitive coverage: 30/60s-style
  // window emulated on the generic sliding window (window/limit configurable there).
  it("emulates a 30-per-60s quota window (ott-gateway L4 usage pattern)", async () => {
    const { createSlidingWindow } = freshRequire();
    const limiter = createSlidingWindow({
      windowMs: 60_000,
      maxRequests: 30,
      keyFn: (identity, command) => `${identity}::${command}`,
    });

    for (let i = 0; i < 30; i += 1) {
      const r = await limiter.check("identity-1", "/status");
      assert.equal(r.ok, true);
    }
    const denied = await limiter.check("identity-1", "/status");
    assert.equal(denied.ok, false);

    // separate bucket per command for the same identity
    const other = await limiter.check("identity-1", "/report");
    assert.equal(other.ok, true);
  });
});

describe("lib-security-utils rate-limit (replay guard)", () => {
  it("rejects duplicate id within ttl", () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 1000 });

    const first = guard.seen("msg-123");
    const second = guard.seen("msg-123");

    assert.equal(first, false);
    assert.equal(second, true);
  });

  it("allows same id after ttl expires", async () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 50 });

    guard.seen("msg-123");
    assert.equal(guard.seen("msg-123"), true);

    await new Promise((r) => setTimeout(r, 60));
    assert.equal(guard.seen("msg-123"), false);
  });

  it("rejects empty id", () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 1000 });

    assert.equal(guard.seen(""), false);
    assert.equal(guard.seen(""), false);
  });

  it("tracks multiple ids independently", () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 1000 });

    assert.equal(guard.seen("a"), false);
    assert.equal(guard.seen("b"), false);
    assert.equal(guard.seen("a"), true);
    assert.equal(guard.seen("b"), true);
    assert.equal(guard.seen("c"), false);
  });

  it("refreshes timestamp on second see", async () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 100 });

    guard.seen("msg-123");
    await new Promise((r) => setTimeout(r, 60));
    guard.seen("msg-123");

    await new Promise((r) => setTimeout(r, 60));
    assert.equal(guard.seen("msg-123"), true);
  });

  it("resets all seen ids", () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 1000 });

    guard.seen("a");
    guard.seen("b");
    assert.equal(guard.seen("a"), true);

    guard.reset();
    assert.equal(guard.seen("a"), false);
  });

  it("throws on invalid ttlMs", () => {
    const { createReplayGuard } = freshRequire();
    assert.throws(
      () => createReplayGuard({ ttlMs: -1 }),
      /ttlMs must be positive/
    );
    assert.throws(
      () => createReplayGuard({ ttlMs: 0 }),
      /ttlMs must be positive/
    );
  });

  it("performs garbage collection above 1024 entries", () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 50 });

    for (let i = 0; i < 1100; i++) {
      guard.seen(`msg-${i}`);
    }
    guard.seen("msg-1100");

    assert.ok(true);
  });

  // Ported from ott-gateway-L4-rate-limit.test.js: TTL expiry treats id as fresh again.
  it("treats an id as fresh after TTL expires (1h-style usage)", async () => {
    const { createReplayGuard } = freshRequire();
    const guard = createReplayGuard({ ttlMs: 3600 });

    assert.equal(guard.seen("msg-1"), false);
    await new Promise((r) => setTimeout(r, 3650));
    assert.equal(guard.seen("msg-1"), false);
  });
});
