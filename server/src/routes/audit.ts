import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { AuditLog } from '../models/AuditLog';
import { Request, Response } from 'express';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin']));
router.use(apiRateLimiter);

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await AuditLog.findRecent(limit);
    res.status(200).json({ logs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
