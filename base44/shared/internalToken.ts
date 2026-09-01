// Shared secret used to gate internal-only backend functions that are triggered
// by automations (entity / scheduled). These functions are HTTP-reachable, so to
// prevent external anonymous callers from invoking them, each checks that
// `body.args.internalToken` (passed via the automation's function_args) matches
// this token. External callers do not know this value and are rejected with 401.
//
// The token is also configured on every automation that invokes a gated function
// (function_args: { internalToken: <this value> }).
export const INTERNAL_AUTOMATION_TOKEN = "cz_au_7f3e9a2c4b1d8e6a0c5f2d7e9b4a1c3e";