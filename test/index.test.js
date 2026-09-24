const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const modulePath = path.resolve(__dirname, "..");

describe("lib-security-utils root export", () => {
  it("re-exports all four factories from the package root", () => {
    const lib = require(modulePath);
    assert.equal(typeof lib.createAuditLogger, "function");
    assert.equal(typeof lib.createCallerValidator, "function");
    assert.equal(typeof lib.createSlidingWindow, "function");
    assert.equal(typeof lib.createReplayGuard, "function");
  });
});
