// Shared secret used to gate internal-only backend functions that are triggered
// by automations (entity / scheduled). These functions are HTTP-reachable, so to
// prevent external anonymous callers from invoking them, each checks that
// `body.args.internalToken` (passed via the automation's function_args) matches
// this token. External callers do not know this value and are rejected with 401.
//
// The token value is stored as the INTERNAL_AUTOMATION_TOKEN environment secret
// (Settings → Environment variables) and is also configured on every automation
// that invokes a gated function (function_args: { internalToken: <same value> }).
import { secrets } from "base44:runtime";

export const INTERNAL_AUTOMATION_TOKEN = secrets.get("INTERNAL_AUTOMATION_TOKEN") ?? "";