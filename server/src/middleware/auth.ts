import { Request, Response, NextFunction } from 'express';
import supabaseAdmin from '../config/supabaseAdmin';

// Extend Express Request type to include user information
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

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
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

    // reviewer/admin roles are assigned manually via the Supabase dashboard (app_metadata) until an admin UI exists.
    // Read role strictly from app_metadata (admin-assigned only); user_metadata is user-writable and untrusted.
    const role: 'officer' | 'reviewer' | 'admin' =
      (data.user.app_metadata?.role as 'officer' | 'reviewer' | 'admin') || 'officer';

    // Attach user info to request
    req.user = {
      id: data.user.id,
      email: data.user.email || '',
      role,
      app_metadata: { role },
      user_metadata: { role },
    };

    next();
  } catch (error) {
    console.error('[Auth Error]', error);
    res.status(401).json({ error: 'Authentication failed', details: (error as Error).message });
  }
};
