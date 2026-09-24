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
declare function createCallerValidator({ extraFields }?: CallerValidatorOpts): CallerValidator;
declare const _default: {
    createCallerValidator: typeof createCallerValidator;
};
export = _default;
