import { Pool } from 'pg';
import { env } from './env';

/**
 * PostgreSQL / PostGIS connection pool.
 *
 * Since the Supabase-only migration this is the app's ONLY datastore — land
 * records, users, audit logs, usage, notifications and the review queue all
 * live in Supabase Postgres (JSONB columns hold nested payloads). Locally the
 * docker-compose PostGIS service stands in for Supabase.
 *
 * The pool is only created when PG_CONNECTION_STRING is configured — pg
 * crashes if it receives an empty connection string / null password at
 * module load time.
 */
export const pgPool: Pool | null = env.PG_CONNECTION_STRING
  ? new Pool({
      connectionString: env.PG_CONNECTION_STRING,
      // Supabase requires SSL; the local docker PostGIS does not.
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
    })
  : null;

export const connectPostgres = async (): Promise<void> => {
  if (!pgPool) {
    console.warn(
      '[db] PG_CONNECTION_STRING not set — the server cannot reach its database. ' +
        'Set it to your Supabase Postgres connection string (or the local docker PostGIS).',
    );
    return;
  }
  try {
    const client = await pgPool.connect();
    console.log('Successfully connected to PostgreSQL/PostGIS');
    client.release();
  } catch (error) {
    console.error('PostgreSQL/PostGIS connection error:', (error as Error).message || error);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('[db:warn] PostgreSQL is not reachable locally. The server is continuing in development mode without a database.');
    }
  }
};
