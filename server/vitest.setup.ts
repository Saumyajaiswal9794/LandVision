// Vitest global setup — runs before any test module is imported.
//
// Tests must run with real auth enforcement: the dev auth bypass loaded from
// server/.env (via config/env.ts) would inject a default user into every
// request and break the 401/403 assertions. Disable it explicitly here.
// dotenv does not override already-set process.env values, so setting these
// before test modules load wins over server/.env.
process.env.ALLOW_DEV_AUTH_BYPASS = 'false';
process.env.NODE_ENV = 'test';
