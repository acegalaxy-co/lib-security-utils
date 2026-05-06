// caller-validator — minimal example for @kanelr/security-utils
//
// Setup:
//   npm install
//   npm run build
//   node examples/caller-validator.js

const { createCallerValidator } = require("@kanelr/security-utils/caller-validator");

const v = createCallerValidator({ extraFields: ["userId"] });
const caller = v.resolveCaller({
  service: "my-bot",
  scope: "public",
  userId: "12345"
});
console.log("Validated caller:", caller);
