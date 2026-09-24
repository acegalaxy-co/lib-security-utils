const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const modulePath = path.resolve(__dirname, "../caller-validator");

function freshRequire() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

describe("lib-security-utils caller-validator", () => {
  it("accepts valid caller with service and scope", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
    });
    assert.deepEqual(result, {
      service: "nexus-bot",
      scope: "nexus",
      roles: [],
    });
  });

  it("rejects null/undefined caller", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    assert.equal(await validator.resolveCaller(null), null);
    assert.equal(await validator.resolveCaller(undefined), null);
  });

  it("rejects caller missing service", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      scope: "nexus",
    });
    assert.equal(result, null);
  });

  it("rejects caller missing scope", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      service: "nexus-bot",
    });
    assert.equal(result, null);
  });

  it("includes roles array if provided", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
      roles: ["admin", "viewer"],
    });
    assert.deepEqual(result.roles, ["admin", "viewer"]);
  });

  it("passes through roles as-is (no filtering)", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
      roles: ["admin", 123, null, "viewer"],
    });
    assert.deepEqual(result.roles, ["admin", 123, null, "viewer"]);
  });

  it("drops unknown fields by default", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
      userId: "abc123",
      extra: "field",
    });
    assert.equal(result.userId, undefined);
    assert.equal(result.extra, undefined);
  });

  it("passes through extra fields when whitelisted", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator({ extraFields: ["userId"] });
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
      userId: "abc123",
      extra: "field",
    });
    assert.equal(result.userId, "abc123");
    assert.equal(result.extra, undefined);
  });

  it("handles empty roles array", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
      roles: [],
    });
    assert.deepEqual(result.roles, []);
  });

  it("defaults roles to empty array if not provided", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
    });
    assert.deepEqual(result.roles, []);
  });

  it("handles non-object caller", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator();
    assert.equal(await validator.resolveCaller("string"), null);
    assert.equal(await validator.resolveCaller(123), null);
    assert.equal(await validator.resolveCaller(true), null);
  });

  it("whitelists multiple extra fields", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator({ extraFields: ["userId", "tenantId"] });
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
      userId: "user-123",
      tenantId: "tenant-456",
      other: "ignored",
    });
    assert.equal(result.userId, "user-123");
    assert.equal(result.tenantId, "tenant-456");
    assert.equal(result.other, undefined);
  });

  it("ignores non-string extra field names", async () => {
    const { createCallerValidator } = freshRequire();
    const validator = createCallerValidator({ extraFields: ["userId", 123, null] });
    const result = await validator.resolveCaller({
      service: "nexus-bot",
      scope: "nexus",
      userId: "user-123",
    });
    assert.equal(result.userId, "user-123");
  });
});
