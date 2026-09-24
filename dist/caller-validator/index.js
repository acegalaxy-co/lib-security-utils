"use strict";
/**
 * Create a caller validator with configurable extra fields.
 *
 * @param {CallerValidatorOpts} [opts]
 * @returns {CallerValidator}
 */
function createCallerValidator({ extraFields = [] } = {}) {
    const extras = Array.isArray(extraFields) ? extraFields.filter((f) => typeof f === "string") : [];
    /**
     * Validate caller. Returns sanitized caller object on success, null on fail.
     * Default-deny: missing caller, missing service, or missing scope → null.
     *
     * @param {*} caller
     * @returns {Promise<Caller|null>}
     */
    async function resolveCaller(caller) {
        if (!caller || typeof caller !== "object")
            return null;
        const callerObj = caller;
        if (!callerObj.service || !callerObj.scope)
            return null;
        const out = {
            service: callerObj.service,
            scope: callerObj.scope,
            roles: Array.isArray(callerObj.roles) ? callerObj.roles : [],
        };
        for (const f of extras) {
            if (f in callerObj)
                out[f] = callerObj[f];
        }
        return out;
    }
    return { resolveCaller };
}
module.exports = { createCallerValidator };
