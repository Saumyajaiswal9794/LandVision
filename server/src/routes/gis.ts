import { Router } from 'express';
import { getPlotBoundary, updatePlotBoundary } from '../controllers/gisController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/boundary', requireAuth, getPlotBoundary);
// TODO: Update role to 'officer' or 'admin' once admin role is introduced in Sprint 2
router.put('/boundary', requireAuth, getPlotBoundary);

export default router;
