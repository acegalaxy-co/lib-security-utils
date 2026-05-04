"use strict";

/**
 * @typedef {Object} Caller
 * @property {string} service
 * @property {string} scope
 * @property {string[]} [roles]
 * @property {*}        [extraField]  any additional field whitelisted via opts.extraFields
 */

/**
 * @typedef {Object} CallerValidatorOpts
 * @property {string[]} [extraFields=[]]  additional caller fields to pass through
 *                                         (whitelisted; unknown fields dropped).
 */

/**
 * @typedef {Object} CallerValidator
 * @property {(caller: any) => Promise<Caller|null>} resolveCaller
 */

interface Caller {
  service: string;
  scope: string;
  roles?: string[];
  [key: string]: unknown;
}

interface CallerValidatorOpts {
  extraFields?: string[];
}

interface CallerValidator {
  resolveCaller: (caller: unknown) => Promise<Caller | null>;
}

/**
 * Create a caller validator with configurable extra fields.
 *
 * @param {CallerValidatorOpts} [opts]
 * @returns {CallerValidator}
 */
function createCallerValidator({ extraFields = [] }: CallerValidatorOpts = {}): CallerValidator {
  const extras: string[] = Array.isArray(extraFields) ? extraFields.filter((f): f is string => typeof f === "string") : [];

  /**
   * Validate caller. Returns sanitized caller object on success, null on fail.
   * Default-deny: missing caller, missing service, or missing scope → null.
   *
   * @param {*} caller
   * @returns {Promise<Caller|null>}
   */
  async function resolveCaller(caller: unknown): Promise<Caller | null> {
    if (!caller || typeof caller !== "object") return null;
    const callerObj = caller as Record<string, unknown>;
    if (!callerObj.service || !callerObj.scope) return null;
    const out: Record<string, unknown> = {
      service: callerObj.service,
      scope: callerObj.scope,
      roles: Array.isArray(callerObj.roles) ? callerObj.roles : [],
    };
    for (const f of extras) {
      if (f in callerObj) out[f] = callerObj[f];
    }
    return out as Caller;
  }

  return { resolveCaller };
}

export = { createCallerValidator };