// NOTE: dotenv is no longer loaded here via `import 'dotenv/config'`.
// `server/src/config/env.ts` now loads `.env` from a path explicitly resolved
// relative to that file, so the right file is found whether the server is
// started via `npm run dev` from the monorepo root (Turborepo, CWD = repo root)
// or directly from inside /server (CWD = /server). Importing env.ts first
// thing below triggers the load before any other module reads process.env.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env, getAllowedOrigins } from './config/env';
import { connectMongoDB, connectPostgres } from './config/db';
import errorHandler from './middleware/errorHandler';

// Import Route Groups
import documentRoutes from './routes/documents';
import recordRoutes from './routes/records';
import authRoutes from './routes/auth';
import validationRoutes from './routes/validation';
import gisRoutes from './routes/gis';

const app = express();

// --- CORS --------------------------------------------------------------------
// Allow only the configured frontend origins (env.CLIENT_ORIGIN).
// In production this MUST be the deployed Vercel URL — never "*" and never a
// hardcoded localhost.
const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    const allowed = getAllowedOrigins();
    // Allow same-origin / curl / Postman requests that omit the Origin header.
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Routes ------------------------------------------------------------------
app.use('/api/documents', documentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/gis', gisRoutes);

// Health Check Route
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- 404 handler for unknown routes -----------------------------------------
// Putting this before the global error handler ensures unmatched URLs return a
// clean JSON 404 instead of falling through to the catch-all error middleware
// with a misleading 500.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Resource not found' });
});

// --- Global Error Handler ----------------------------------------------------
// Catches any unhandled error from routes/controllers, logs it, and returns a
// generic JSON response. In production the stack trace is NEVER leaked to the
// client — only a sanitized `Internal Server Error` message is returned.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  errorHandler(err, _req, res, _next);
});

// --- Database connection & Server Boot ---------------------------------------
const bootstrap = async () => {
  try {
    // Only connect in non-test modes
    if (process.env.NODE_ENV !== 'test') {
      await connectMongoDB();
      await connectPostgres();
    }

    // Render assigns PORT dynamically — always read env.PORT, never a hardcoded value.
    const port = env.PORT;
    app.listen(port, () => {
      console.log(`[Server] LandVision backend API running on port ${port}`);
      console.log(`[Server] CORS allowed origins: ${getAllowedOrigins().join(', ')}`);
    });
  } catch (error) {
    console.error('Bootstrap failure:', error);
    process.exit(1);
  }
};

bootstrap();

export default app;
