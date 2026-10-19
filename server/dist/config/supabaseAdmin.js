"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
// Supabase Admin Client (service role)
// Used for server-side operations like verifying tokens, managing users, accessing storage
//
// Lazily initialised so the server can boot even when SUPABASE_URL / SERVICE_KEY
// are missing (common during local dev when you only need non-Supabase features).
// The client is created on first access; callers that actually need Supabase will
// get a clear error at that point.
let _supabaseAdmin = null;
function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        const key = env_1.env.SUPABASE_SERVICE_KEY && env_1.env.SUPABASE_SERVICE_KEY !== 'your-supabase-service-role-key'
            ? env_1.env.SUPABASE_SERVICE_KEY
            : env_1.env.SUPABASE_ANON_KEY;
        if (!env_1.env.SUPABASE_URL || !key || key === 'your-supabase-anon-key') {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set to use Supabase features. ' +
                'Add them to server/.env — see server/.env.example for reference.');
        }
        _supabaseAdmin = (0, supabase_js_1.createClient)(env_1.env.SUPABASE_URL, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }
    return _supabaseAdmin;
}
// Proxy object that lazily initialises the real client on first property access.
// This preserves the existing `supabaseAdmin.storage`, `supabaseAdmin.auth`, etc.
// call-sites unchanged while deferring the `createClient()` call.
exports.supabaseAdmin = new Proxy({}, {
    get(_target, prop, receiver) {
        return Reflect.get(getSupabaseAdmin(), prop, receiver);
    },
});
exports.default = exports.supabaseAdmin;
