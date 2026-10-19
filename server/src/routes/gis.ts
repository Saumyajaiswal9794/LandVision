import { Router } from 'express';
import { getVillagePlots, getPlotByKhasraRoute, getPlotBoundary } from '../controllers/gisController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Sprint 4: New GIS endpoints
router.get('/village/:villageName', requireAuth, getVillagePlots);
router.get('/plot/:khasraNumber', requireAuth, getPlotByKhasraRoute);

// Legacy placeholder routes (kept for backward compatibility)
router.get('/boundary', requireAuth, getPlotBoundary);

export default router;
