import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Supabase Admin Client (service role)
// Used for server-side operations like verifying tokens, managing users, accessing storage
//
// Lazily initialised so the server can boot even when SUPABASE_URL / SERVICE_KEY
// are missing (common during local dev when you only need non-Supabase features).
// The client is created on first access; callers that actually need Supabase will
// get a clear error at that point.
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set to use Supabase features. ' +
        'Add them to server/.env — see server/.env.example for reference.',
      );
    }
    _supabaseAdmin = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return _supabaseAdmin;
}

// Proxy object that lazily initialises the real client on first property access.
// This preserves the existing `supabaseAdmin.storage`, `supabaseAdmin.auth`, etc.
// call-sites unchanged while deferring the `createClient()` call.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseAdmin(), prop, receiver);
  },
});

export default supabaseAdmin;
