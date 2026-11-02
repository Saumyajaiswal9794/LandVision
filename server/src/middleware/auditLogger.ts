import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';

/**
 * auditLogger — records every mutation (POST / PUT / PATCH / DELETE) made
 * through the routes it is mounted on into the `auditlogs` collection, so
 * the admin audit page shows real system activity.
 *
 * Persists AFTER the response is sent (on `finish`), using the final status
 * code, and never breaks the request flow if logging fails.
 */
export const auditLogger = (action: string, resourceType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      try {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;

        const user = (req as any).user;
        if (!user?.id) return; // unauthenticated requests are rejected by requireAuth anyway

        void AuditLog.create({
          userId: user.id,
          userEmail: user.email ?? null,
          action,
          resourceType,
          resourceId: req.params.id || req.body?.id || null,
          ip: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
          metadata: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
          },
        }).catch((err) =>
          console.warn('[AuditLogger] Failed to persist audit log:', (err as Error).message),
        );
      } catch (err) {
        // Don't break the response if logging fails
      }
    });
    next();
  };
};
