import mongoose from 'mongoose';
import { Pool } from 'pg';
import { env } from './env';

// 1. MongoDB Connection Setup (using Mongoose)
export const connectMongoDB = async (): Promise<void> => {
  if (!env.MONGODB_URI) {
    console.warn('[db] MONGODB_URI not set — skipping MongoDB connection.');
    return;
  }
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Successfully connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// 2. PostgreSQL / PostGIS Connection Setup (using pg Pool)
// Only create the pool when PG_CONNECTION_STRING is configured — pg crashes if
// it receives an empty connection string / null password at module load time.
export const pgPool: Pool | null = env.PG_CONNECTION_STRING
  ? new Pool({
      connectionString: env.PG_CONNECTION_STRING,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

export const connectPostgres = async (): Promise<void> => {
  if (!pgPool) {
    console.warn('[db] PG_CONNECTION_STRING not set — skipping PostgreSQL connection.');
    return;
  }
  try {
    const client = await pgPool.connect();
    console.log('Successfully connected to PostgreSQL/PostGIS');
    client.release();
  } catch (error) {
    console.error('PostgreSQL/PostGIS connection error:', error);
    process.exit(1);
  }
};

