import mongoose from 'mongoose';
import { Pool } from 'pg';
import { env } from './env';

// 1. MongoDB Connection Setup (using Mongoose)
export const connectMongoDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Successfully connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// 2. PostgreSQL / PostGIS Connection Setup (using pg Pool)
export const pgPool = new Pool({
  connectionString: env.PG_CONNECTION_STRING,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const connectPostgres = async (): Promise<void> => {
  try {
    const client = await pgPool.connect();
    console.log('Successfully connected to PostgreSQL/PostGIS');
    client.release();
  } catch (error) {
    console.error('PostgreSQL/PostGIS connection error:', error);
    process.exit(1);
  }
};
