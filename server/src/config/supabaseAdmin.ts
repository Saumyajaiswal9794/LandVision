import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Supabase Admin Client (service role)
// Used for server-side operations like verifying tokens, managing users, accessing storage
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export default supabaseAdmin;
