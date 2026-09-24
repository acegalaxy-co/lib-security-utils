import auditLog = require("./audit-log");
import callerValidator = require("./caller-validator");
import rateLimit = require("./rate-limit");
type ExportsOf<M> = {
    [K in keyof M]: M[K];
};
declare const lib: ExportsOf<typeof auditLog> & ExportsOf<typeof callerValidator> & ExportsOf<typeof rateLimit>;
export = lib;
