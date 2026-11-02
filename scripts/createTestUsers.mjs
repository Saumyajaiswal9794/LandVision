// scripts/createTestUsers.mjs
//
// Creates demo/test users in Supabase Auth (idempotent — existing users are
// left alone) so the app can be exercised end-to-end locally.
//
// Usage (env vars required):
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/createTestUsers.mjs
//
// Users created:
//   officer@landvision.test   / Test1234!   role: officer
//   reviewer@landvision.test  / Test1234!   role: reviewer
//   admin@landvision.test     / Test1234!   role: admin
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  { email: 'officer@landvision.test', password: 'Test1234!', role: 'officer' },
  { email: 'reviewer@landvision.test', password: 'Test1234!', role: 'reviewer' },
  { email: 'admin@landvision.test', password: 'Test1234!', role: 'admin' },
];

for (const u of users) {
  // Create or update — app_metadata carries the authoritative role.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error('listUsers failed:', error.message);
    process.exit(1);
  }
  const existing = data.users.find((x) => x.email === u.email);
  if (existing) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
      app_metadata: { role: u.role },
    });
    if (updErr) console.error(`update ${u.email} failed:`, updErr.message);
    else console.log(`updated ${u.email} (role=${u.role})`);
  } else {
    const { error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      app_metadata: { role: u.role },
    });
    if (createErr) console.error(`create ${u.email} failed:`, createErr.message);
    else console.log(`created ${u.email} (role=${u.role})`);
  }
}
console.log('done');
