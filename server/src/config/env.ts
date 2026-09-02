// Environment configuration loader
//
// In production (NODE_ENV=production) EVERY required variable listed below is
// MANDATORY. If any is missing the loader throws a fatal error and the
// process exits non-zero so a bad deploy fails loudly instead of silently
// running broken (Sprint 5 hardening rule).
//
// In development missing variables only emit a console.warn so you can still
// boot the server for partial work (e.g. testing only the API without GIS).

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
    `Copy .env.production.example to .env.production and fill in real values, ` +
    `or set them in your hosting dashboard (Render/Vercel).`;

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
 * Returns the CORS allowed origins as an array of trimmed strings.
 * Reads from env.CLIENT_ORIGIN (comma-separated).
 */
export function getAllowedOrigins(): string[] {
  return env.CLIENT_ORIGIN
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
