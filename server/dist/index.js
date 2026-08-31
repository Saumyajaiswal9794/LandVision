"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes Binding
app.use('/api/documents', documents_1.default);
app.use('/api/records', records_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/validation', validation_1.default);
app.use('/api/gis', gis_1.default);
// Health Check Route
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Global Error Handler
app.use(errorHandler_1.default);
// Database connection & Server Boot
const bootstrap = async () => {
    try {
        // Only connect in non-test modes
        if (process.env.NODE_ENV !== 'test') {
            await (0, db_1.connectMongoDB)();
            await (0, db_1.connectPostgres)();
        }
        app.listen(env_1.env.PORT, () => {
            console.log(`[Server] LandVision backend API running on port ${env_1.env.PORT}`);
        });
    }
    catch (error) {
        console.error('Bootstrap failure:', error);
        process.exit(1);
    }
};
bootstrap();
exports.default = app;
