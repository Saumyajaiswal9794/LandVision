"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const getEnvVar = (key, defaultValue) => {
    const value = process.env[key] || defaultValue;
    if (!value) {
        throw new Error(`Environment variable ${key} is missing`);
    }
    return value;
};
exports.env = {
    PORT: parseInt(getEnvVar('PORT', '4000'), 10),
    NODE_ENV: getEnvVar('NODE_ENV', 'development'),
    MONGODB_URI: getEnvVar('MONGODB_URI'),
    PG_CONNECTION_STRING: getEnvVar('PG_CONNECTION_STRING'),
    SUPABASE_URL: getEnvVar('SUPABASE_URL'),
    SUPABASE_KEY: getEnvVar('SUPABASE_KEY'),
    SUPABASE_JWT_SECRET: getEnvVar('SUPABASE_JWT_SECRET'),
    SUPABASE_STORAGE_BUCKET: getEnvVar('SUPABASE_STORAGE_BUCKET', 'land-records'),
    GOOGLE_VISION_API_KEY: getEnvVar('GOOGLE_VISION_API_KEY'),
    LLM_API_KEY: getEnvVar('LLM_API_KEY'),
};
