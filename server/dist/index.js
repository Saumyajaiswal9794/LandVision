"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// NOTE: dotenv is no longer loaded here via `import 'dotenv/config'`.
// `server/src/config/env.ts` now loads `.env` from a path explicitly resolved
// relative to that file, so the right file is found whether the server is
// started via `npm run dev` from the monorepo root (Turborepo, CWD = repo root)
// or directly from inside /server (CWD = /server). Importing env.ts first
// thing below triggers the load before any other module reads process.env.
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const errorHandler_1 = __importDefault(require("./middleware/errorHandler"));
// Import Route Groups
const documents_1 = __importDefault(require("./routes/documents"));
const records_1 = __importDefault(require("./routes/records"));
const auth_1 = __importDefault(require("./routes/auth"));
const validation_1 = __importDefault(require("./routes/validation"));
const gis_1 = __importDefault(require("./routes/gis"));
const app = (0, express_1.default)();
// --- CORS --------------------------------------------------------------------
// Allow only the configured frontend origins (env.CLIENT_ORIGIN).
// In production this MUST be the deployed Vercel URL — never "*" and never a
// hardcoded localhost.
const corsOptions = {
    origin(origin, callback) {
        const allowed = (0, env_1.getAllowedOrigins)();
        // Allow same-origin / curl / Postman requests that omit the Origin header.
        if (!origin || allowed.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS blocked origin: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// --- Routes ------------------------------------------------------------------
app.use('/api/documents', documents_1.default);
app.use('/api/records', records_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/validation', validation_1.default);
app.use('/api/gis', gis_1.default);
// Health Check Route
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// --- 404 handler for unknown routes -----------------------------------------
// Putting this before the global error handler ensures unmatched URLs return a
// clean JSON 404 instead of falling through to the catch-all error middleware
// with a misleading 500.
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Resource not found' });
});
// --- Global Error Handler ----------------------------------------------------
// Catches any unhandled error from routes/controllers, logs it, and returns a
// generic JSON response. In production the stack trace is NEVER leaked to the
// client — only a sanitized `Internal Server Error` message is returned.
app.use((err, _req, res, _next) => {
    (0, errorHandler_1.default)(err, _req, res, _next);
});
// --- Database connection & Server Boot ---------------------------------------
const bootstrap = async () => {
    try {
        // Only connect in non-test modes
        if (process.env.NODE_ENV !== 'test') {
            await (0, db_1.connectMongoDB)();
            await (0, db_1.connectPostgres)();
        }
        // Render assigns PORT dynamically — always read env.PORT, never a hardcoded value.
        const port = env_1.env.PORT;
        app.listen(port, () => {
            console.log(`[Server] LandVision backend API running on port ${port}`);
            console.log(`[Server] CORS allowed origins: ${(0, env_1.getAllowedOrigins)().join(', ')}`);
        });
    }
    catch (error) {
        console.error('Bootstrap failure:', error);
        process.exit(1);
    }
};
bootstrap();
exports.default = app;
