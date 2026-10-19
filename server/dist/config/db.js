"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectPostgres = exports.pgPool = exports.connectMongoDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const pg_1 = require("pg");
const env_1 = require("./env");
// 1. MongoDB Connection Setup (using Mongoose)
const connectMongoDB = async () => {
    if (!env_1.env.MONGODB_URI) {
        console.warn('[db] MONGODB_URI not set — skipping MongoDB connection.');
        return;
    }
    try {
        await mongoose_1.default.connect(env_1.env.MONGODB_URI);
        console.log('Successfully connected to MongoDB');
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
exports.connectMongoDB = connectMongoDB;
// 2. PostgreSQL / PostGIS Connection Setup (using pg Pool)
// Only create the pool when PG_CONNECTION_STRING is configured — pg crashes if
// it receives an empty connection string / null password at module load time.
exports.pgPool = env_1.env.PG_CONNECTION_STRING
    ? new pg_1.Pool({
        connectionString: env_1.env.PG_CONNECTION_STRING,
        ssl: env_1.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
    : null;
const connectPostgres = async () => {
    if (!exports.pgPool) {
        console.warn('[db] PG_CONNECTION_STRING not set — skipping PostgreSQL connection.');
        return;
    }
    try {
        const client = await exports.pgPool.connect();
        console.log('Successfully connected to PostgreSQL/PostGIS');
        client.release();
    }
    catch (error) {
        console.error('PostgreSQL/PostGIS connection error:', error.message || error);
        if (env_1.env.NODE_ENV === 'production') {
            process.exit(1);
        }
        else {
            console.warn('[db:warn] PostgreSQL is not reachable locally. The server is continuing in development mode without PostGIS.');
        }
    }
};
exports.connectPostgres = connectPostgres;
