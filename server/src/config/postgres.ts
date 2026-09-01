import { pgPool } from './db';

/**
 * Re-export the existing pgPool from db.ts as the canonical Postgres/PostGIS connection.
 * All GIS queries should use this pool.
 */
export { pgPool };
export default pgPool;
