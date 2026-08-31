import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export const requireRole = (allowedRoles: ('officer' | 'reviewer')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.user_metadata?.role;

    if (!userRole) {
      res.status(403).json({ 
        error: 'Forbidden: User role not set. Please complete profile setup.' 
      });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ 
        error: `Forbidden: Your role (${userRole}) does not have access to this resource.` 
      });
      return;
    }

    next();
  };
};

// Legacy export for backward compatibility
export const checkRole = (allowedRoles: ('officer' | 'reviewer')[]) => requireRole(allowedRoles);
