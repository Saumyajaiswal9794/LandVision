import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { listUsers, updateUserRole, getUser } from '../controllers/adminController';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { AuditLog } from '../models/AuditLog';
import { ApiUsage } from '../models/ApiUsage';
import { Request, Response } from 'express';

import { auditLogger } from '../middleware/auditLogger';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin']));
router.use(apiRateLimiter);

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.put('/users/:id/role', auditLogger('user.role_update', 'user'), updateUserRole);

router.get('/audit', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await AuditLog.findRecent(limit);
    res.status(200).json({ logs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/usage', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const usage = await ApiUsage.findRecent(limit);
    const totalCost = usage.reduce((sum, u) => sum + (u.cost || 0), 0);
    res.status(200).json({ usage, totalCost });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
