import 'express';

declare global {
  namespace Express {
    interface Request {
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
  }
}