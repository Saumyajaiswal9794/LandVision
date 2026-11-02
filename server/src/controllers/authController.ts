import { Response } from 'express';
import { Request } from 'express';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Try to get full profile from DB
    try {
      const dbUser = await User.findBySupabaseId(user.id);
      if (dbUser) {
        res.status(200).json({ 
          user: {
            id: dbUser.supabaseId,
            email: dbUser.email,
            role: dbUser.role,
            name: dbUser.name,
            createdAt: dbUser.createdAt,
            lastLoginAt: dbUser.lastLoginAt,
          }
        });
        return;
      }
    } catch (err) {
      console.error('[Auth] Error fetching profile from DB:', err);
    }
    
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const syncUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const role: 'officer' | 'reviewer' | 'admin' =
      (user.app_metadata?.role as 'officer' | 'reviewer' | 'admin') ||
      (user.user_metadata?.role as 'officer' | 'reviewer' | 'admin') ||
      user.role ||
      'officer';

    const dbUser = await User.upsertBySupabaseId({
      supabaseId: user.id,
      email: user.email,
      role,
      lastLoginAt: new Date(),
    });

    res.status(200).json({
      message: 'User synchronized successfully',
      user: {
        id: dbUser.supabaseId,
        email: dbUser.email,
        role: dbUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
