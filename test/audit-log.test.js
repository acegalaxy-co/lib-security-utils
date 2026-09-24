const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const modulePath = path.resolve(__dirname, "../audit-log");

function freshRequire() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

describe("lib-security-utils audit-log", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lib-security-utils-audit-"));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates audit logger with required path and tag", () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    const logger = createAuditLogger({ logPath, tag: "test-logger" });
    assert.equal(logger.LOG_PATH, logPath);
  });

  it("throws on missing logPath", () => {
    const { createAuditLogger } = freshRequire();
    assert.throws(
      () => createAuditLogger({ tag: "test-logger" }),
      /logPath required/
    );
  });

  it("throws on missing tag", () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    assert.throws(
      () => createAuditLogger({ logPath }),
      /tag required/
    );
  });

  it("throws on invalid mode", () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    assert.throws(
      () => createAuditLogger({ logPath, tag: "test", mode: "invalid" }),
      /invalid mode/
    );
  });

  it("writes record synchronously in sync mode", async () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    const logger = createAuditLogger({ logPath, tag: "test", mode: "sync" });

    await logger.record({ outcome: "allow", latencyMs: 5 });
    const content = fs.readFileSync(logPath, "utf8");
    const parsed = JSON.parse(content.trim());
    assert.equal(parsed.outcome, "allow");
    assert.equal(parsed.latencyMs, 5);
  });

  it("appends multiple records as JSONL", async () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    const logger = createAuditLogger({ logPath, tag: "test", mode: "sync" });

    await logger.record({ id: 1, outcome: "allow" });
    await logger.record({ id: 2, outcome: "deny", denyReason: "L2_unknown" });

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).id, 1);
    assert.equal(JSON.parse(lines[1]).id, 2);
  });

  it("writes record asynchronously in async mode", async () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    const logger = createAuditLogger({ logPath, tag: "test", mode: "async" });

    await logger.record({ outcome: "allow" });
    await new Promise((r) => setTimeout(r, 50));

    const content = fs.readFileSync(logPath, "utf8");
    const parsed = JSON.parse(content.trim());
    assert.equal(parsed.outcome, "allow");
  });

  it("defaults to sync mode", async () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    const logger = createAuditLogger({ logPath, tag: "test" });

    await logger.record({ outcome: "allow" });
    const content = fs.readFileSync(logPath, "utf8");
    assert.ok(content.includes("allow"));
  });

  it("swallows write errors without throwing", async () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "readonly.log");
    const logger = createAuditLogger({ logPath, tag: "test", mode: "sync" });

    fs.writeFileSync(logPath, "");
    fs.chmodSync(tmpDir, 0o444);

    let threw = false;
    try {
      await logger.record({ outcome: "allow" });
    } catch {
      threw = true;
    }

    fs.chmodSync(tmpDir, 0o755);
    assert.equal(threw, false);
  });

  it("preserves record object as-is in JSON", async () => {
    const { createAuditLogger } = freshRequire();
    const logPath = path.join(tmpDir, "audit.log");
    const logger = createAuditLogger({ logPath, tag: "test", mode: "sync" });

    const rec = {
      ts: "2026-05-25T10:00:00Z",
      store: "postgres",
      op: "read",
      callerService: "nexus-bot",
      outcome: "allow",
      latencyMs: 42,
      rowCount: 10,
    };
    await logger.record(rec);

    const content = fs.readFileSync(logPath, "utf8");
    const parsed = JSON.parse(content.trim());
    assert.deepEqual(parsed, rec);
  });
});
