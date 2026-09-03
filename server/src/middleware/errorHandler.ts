import { Request, Response, NextFunction } from 'express';

/**
 * Global Express error-handling middleware (Sprint 5 hardening).
 *
 * Behaviour:
 * - ALWAYS logs the full error server-side for debugging.
 * - NEVER leaks the stack trace to the client in production.
 * - Honours HTTP-aware errors (objects with a numeric `status` field).
 * - Returns a clean JSON envelope `{ success, error, ...(dev: stack) }` so the
 *   client always gets a parseable response even on catastrophic failure.
 *
 * Mount this LAST in the middleware chain, after all routes, so any unhandled
 * error thrown in routes/controllers lands here instead of crashing the
 * process or returning Express's default HTML error page.
 */
export const errorHandler = (
  error: Error & { status?: number; code?: string; details?: unknown },
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  // --- Server-side log -----------------------------------------------------
  // Full context so logs are sufficient for debugging without needing to
  // reproduce the request.
  console.error(`[Error] ${req.method} ${req.originalUrl} — ${error.name}: ${error.message}`);
  if (!isProduction && error.stack) {
    console.error(error.stack);
  }

  // --- Determine status ----------------------------------------------------
  // Default to 500. Honour explicit `status` on HTTP-aware errors (e.g. thrown
  // by middleware like `http-errors` or by our own controllers).
  const status = typeof error.status === 'number' && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

  // --- Build client response ----------------------------------------------
  // In production NEVER send the raw message of a 500 error to the client —
  // they could contain stack/internal info. Only forward messages for
  // client-controlled (4xx) errors where the message was crafted by us.
  const isClientError = status >= 400 && status < 500;
  const safeMessage = isClientError
    ? error.message || 'Bad Request'
    : 'Internal Server Error';

  res.status(status).json({
    success: false,
    error: safeMessage,
    // Only include stack in development — never in production.
    ...(isProduction ? {} : { stack: error.stack }),
  });
};

export default errorHandler;
