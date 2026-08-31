// Environment configuration loader
const requiredEnvVars = [
  'MONGODB_URI',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'PG_CONNECTION_STRING',
  'GEMINI_API_KEY',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`[Warning] Missing environment variables: ${missingEnvVars.join(', ')}`);
}

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

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
