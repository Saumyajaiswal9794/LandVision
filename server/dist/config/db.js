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
exports.pgPool = new pg_1.Pool({
    connectionString: env_1.env.PG_CONNECTION_STRING,
    ssl: env_1.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
const connectPostgres = async () => {
    try {
        const client = await exports.pgPool.connect();
        console.log('Successfully connected to PostgreSQL/PostGIS');
        client.release();
    }
    catch (error) {
        console.error('PostgreSQL/PostGIS connection error:', error);
        process.exit(1);
    }
};
exports.connectPostgres = connectPostgres;
