import { Request, Response, NextFunction } from 'express';
import supabaseAdmin from '../config/supabaseAdmin';
import { User } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'officer' | 'reviewer' | 'admin';
    app_metadata?: {
      role?: 'officer' | 'reviewer' | 'admin';
    };
    user_metadata?: {
      role?: 'officer' | 'reviewer' | 'admin';
    };
  };
}

/**
 * requireAuth — verifies the Supabase JWT and syncs the user's role from the
 * local `users` collection (so role changes made in the admin panel take
 * effect immediately, without waiting for a new Supabase token).
 *
 * The role stored in the database always wins over app_metadata; app_metadata is
 * only used as the default when the user has not been synced yet.
 *
 * Dev bypass: when the app-level ALLOW_DEV_AUTH_BYPASS middleware has already
 * attached `req.user`, verification is skipped so local API testing works
 * without a Supabase token. The bypass middleware is never mounted in
 * production (see src/index.ts).
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Dev-only bypass: user was already injected by the app-level middleware.
    const preExisting = (req as AuthenticatedRequest).user;
    if (preExisting?.id) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;

    // Check for missing or malformed Authorization header
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Invalid Authorization header format. Expected "Bearer <token>"' });
      return;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    if (!token || token.length === 0) {
      res.status(401).json({ error: 'Invalid or empty token' });
      return;
    }

    // Verify token with Supabase Admin client
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      res.status(401).json({ error: 'Invalid or expired token', details: error.message });
      return;
    }

    if (!data.user) {
      res.status(401).json({ error: 'Token verification failed: no user data' });
      return;
    }

    // Default role from Supabase app_metadata (admin-assigned); the local
    // users collection overrides it once the user has been synced.
    const supabaseRole: 'officer' | 'reviewer' | 'admin' =
      (data.user.app_metadata?.role as 'officer' | 'reviewer' | 'admin') || 'officer';

    // Sync with the local users collection — read the authoritative role.
    // NOTE: we intentionally do NOT write lastLoginAt here; this middleware
    // runs on EVERY request and a write per request would hammer the database.
    // Login-time updates go through POST /api/auth/sync instead.
    let dbRole = supabaseRole;
    try {
      const dbUser = await User.findBySupabaseId(data.user.id);
      if (dbUser) {
        dbRole = dbUser.role;
      } else {
        // First request from this Supabase user — create the local record.
        const created = await User.create({
          supabaseId: data.user.id,
          email: data.user.email || '',
          role: supabaseRole,
          lastLoginAt: new Date(),
        });
        dbRole = created.role;
      }
    } catch (err) {
      console.error('[Auth] Error syncing user to DB:', err);
      // Fall back to app_metadata role
    }

    // Attach user info to request
    (req as AuthenticatedRequest).user = {
      id: data.user.id,
      email: data.user.email || '',
      role: dbRole,
      app_metadata: { role: dbRole },
      user_metadata: { role: dbRole },
    };

    next();
  } catch (error) {
    console.error('[Auth Error]', error);
    res.status(401).json({ error: 'Authentication failed', details: (error as Error).message });
  }
};
