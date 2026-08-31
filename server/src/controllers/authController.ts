import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.status(200).json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const syncUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Boilerplate for syncing Supabase auth state metadata into MongoDB User records
    res.status(200).json({
      message: 'User synchronized successfully',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
