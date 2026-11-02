// NOTE: dotenv is no longer loaded here via `import 'dotenv/config'`.
// `server/src/config/env.ts` now loads `.env` from a path explicitly resolved
// relative to that file, so the right file is found whether the server is
// started via `npm run dev` from the monorepo root (Turborepo, CWD = repo root)
// or directly from inside /server (CWD = /server). Importing env.ts first
// thing below triggers the load before any other module reads process.env.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env, getAllowedOrigins } from './config/env';
import { connectPostgres, pgPool } from './config/db';
import errorHandler from './middleware/errorHandler';
import { AuthenticatedRequest } from './middleware/auth';
import pino from 'pino';
import { Server } from 'http';
const logger = pino({
  level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
  base: {},
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    censor: '*****'
  },
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
});
import pinoHttp from 'pino-http';
import crypto from 'crypto';

// Import Route Groups
import documentRoutes from './routes/documents';
import recordRoutes from './routes/records';
import authRoutes from './routes/auth';
import gisRoutes from './routes/gis';
import adminRoutes from './routes/admin';
import reviewQueueRoutes from './routes/reviewQueue';
import notificationRoutes from './routes/notifications';
import auditRoutes from './routes/audit';

const app = express();

// Security headers
app.use(helmet());

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
app.use(pinoHttp({
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID()
}));
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// --- Dev-only: inject default user for local development without auth ---
// Never active in production. Only injects when the request carries NO
// Authorization header, so real Supabase tokens still authenticate (and
// sync) normally even with the bypass enabled. requireAuth honours the
// pre-attached user and skips token verification (see src/middleware/auth.ts).
if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_BYPASS === 'true') {
  app.use((req: Request, _res, next) => {
    if (!req.headers.authorization) {
      (req as AuthenticatedRequest).user = {
        id: 'dev-user',
        email: 'dev@example.com',
        role: 'officer',
        app_metadata: { role: 'officer' },
        user_metadata: { role: 'officer' },
      };
    }
    next();
  });
}

// --- Routes ------------------------------------------------------------------
app.use('/api/documents', documentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/review-queue', reviewQueueRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);

// Health Check Route
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness endpoint checks DB connections
app.get('/ready', async (_req, res) => {
  const dependencies: Record<string, string> = {};
  // Postgres check — pgPool is imported at the top of this module. This is
  // the app's ONLY datastore (Supabase Postgres / local docker PostGIS).
  let pgUp = false;
  if (pgPool) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
      await Promise.race([pgPool.query('SELECT 1'), timeout]);
      pgUp = true;
    } catch {}
  }
  dependencies.postgres = pgUp ? 'up' : 'down';
  const allUp = Object.values(dependencies).every(v => v === 'up');
  res.status(allUp ? 200 : 503).json({ status: allUp ? 'ok' : 'fail', dependencies });
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
let server: Server;
let shuttingDown = false;

const bootstrap = async () => {
  try {
    // Only connect and listen in non-test modes
    if (process.env.NODE_ENV !== 'test') {
      await connectPostgres();

      // Render assigns PORT dynamically — always read env.PORT, never a hardcoded value.
      const port = env.PORT;
  server = app.listen(port, () => {

  
      }); // server reference captured above
    }
  } catch (error) {
    console.error('Bootstrap failure:', error);
    process.exit(1);
  }
};

bootstrap();

// --- Process-level safety net ------------------------------------------------
// tesseract.js can emit worker errors (e.g. corrupt/undecodable images) that
// surface as uncaught exceptions rather than promise rejections. Without this
// handler a single bad scan would crash the whole server. Log and keep
// serving — the extraction pipeline already records extraction_failed.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception (server kept alive)');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection (server kept alive)');
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  const forced = setTimeout(() => {
    logger.error('Forced shutdown timeout');
    process.exit(1);
  }, 10000).unref();

  // Close HTTP server
  server?.close(() => {
    logger.info('HTTP server closed');
  });
  // Close the Postgres pool (the app's only datastore)
  // Close Postgres pool
  if (pgPool) {
    try {
      await pgPool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err: unknown) {
      logger.error({ err }, 'Error closing PostgreSQL pool');
    }
  }
  // No extraction queue stop function present.
  clearTimeout(forced);
  process.exit(0);
};




export default app;
