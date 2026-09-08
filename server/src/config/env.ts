// Environment configuration loader
//
// This file is responsible for making sure `process.env` is populated from the
// correct `.env` file BEFORE the rest of the server reads any variables.
//
// Why we don't rely on `import 'dotenv/config'` from index.ts alone:
//   `dotenv/config` reads `.env` from `process.cwd()`. When the server is started
//   via Turborepo from the monorepo root (`npm run dev` at repo root) the CWD
//   is the monorepo root, NOT `server/`, so `dotenv` would look for
//   `<root>/.env` instead of `server/.env`. The same applies to a production
//   `node dist/index.js` start — the CWD is whatever the deploy process chose.
//
// The fix: explicitly resolve `server/.env` relative to THIS file's location,
// which is stable regardless of whether the file is being executed from
// `server/src/config/env.ts` (ts-node dev) or from the compiled
// `server/dist/config/env.js` (production). In both cases `server/.env` is
// exactly two directories up from this module: `<this_dir>/../../.env`.
//
// In production (NODE_ENV=production) EVERY required variable listed below is
// MANDATORY. If any is missing the loader throws a fatal error and the
// process exits non-zero so a bad deploy fails loudly instead of silently
// running broken (Sprint 5 hardening rule).
//
// In development missing variables only emit a console.warn so you can still
// boot the server for partial work (e.g. testing only the API without GIS).

import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Resolve `server/.env` relative to this file's location.
//
// - When running via ts-node (dev): __dirname = server/src/config
//   => path = server/src/config/../../.env = server/.env
// - When running from compiled JS (prod): __dirname = server/dist/config
//   => path = server/dist/config/../../.env = server/.env
//
// Both cases resolve to the same canonical `server/.env` file, so the config
// works identically whether started via `npm run dev` from the monorepo root
// (Turborepo) or directly from inside /server.
const ENV_FILE_PATH = path.resolve(__dirname, '..', '..', '.env');

// Only load the file if it exists. If `server/.env` is genuinely missing in
// development we silently fall through and the per-variable warning below
// will tell the developer exactly what's missing — which is the desired UX.
if (fs.existsSync(ENV_FILE_PATH)) {
  const result = dotenv.config({ path: ENV_FILE_PATH });
  if (result.error) {
    // dotenv returns a parse error object if the file is malformed; surface
    // it loudly so the developer fixes the file instead of being confused by
    // undefined variables downstream.
    console.warn(`[env:warn] Failed to parse ${ENV_FILE_PATH}: ${result.error.message}`);
  }
}

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'PG_CONNECTION_STRING',
  'GEMINI_API_KEY',
  'CLIENT_ORIGIN',
] as const;

const missingEnvVars = REQUIRED_ENV_VARS.filter((envVar) => !process.env[envVar]);

const isProduction = process.env.NODE_ENV === 'production';

if (missingEnvVars.length > 0) {
  const message =
    `[env] Missing required environment variable(s): ${missingEnvVars.join(', ')}. ` +
    `Copy server/.env.example to server/.env and fill in real values for local dev, ` +
    `or set them in your hosting dashboard (Render/Vercel) for production. ` +
    `Resolved .env path: ${ENV_FILE_PATH}`;

  if (isProduction) {
    // Fail loud and clear — a bad deploy must NOT silently run with broken config.
    // We write to stderr first so logs surface the cause even if the throw itself
    // gets swallowed by a worker.
    console.error('\n[FATAL] ' + message + '\n');
    throw new Error(message);
  } else {
    // Development: warn and continue so partial dev work stays possible.
    console.warn(`[env:warn] ${message}`);
  }
}

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // CORS: comma-separated list of allowed browser origins for the frontend.
  // Falls back to localhost:3000 so local dev keeps working without an env file.
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/landvision',

  // Supabase (Auth + Storage)
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',

  // PostgreSQL / PostGIS
  PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING || '',

  // Gemini AI (Sprint 2)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Validation (Sprint 2)
  CONFIDENCE_THRESHOLD: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.75'),

  // Area validation: max total plot area per village (in hectares, default 500)
  VILLAGE_AREA_LIMIT_HECTARES: parseFloat(process.env.VILLAGE_AREA_LIMIT_HECTARES || '500'),
};

/**
 * Returns the resolved filesystem path that this loader looks for `.env` at.
 * Exposed for tests / debugging — DO NOT use to bypass the loader.
 */
export const RESOLVED_ENV_PATH = ENV_FILE_PATH;

/**
 * Returns the CORS allowed origins as an array of trimmed strings.
 * Reads from env.CLIENT_ORIGIN (comma-separated).
 */
export function getAllowedOrigins(): string[] {
  return env.CLIENT_ORIGIN
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
