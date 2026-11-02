import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { getVillagePlots, getPlotByKhasraRoute, getPlotBoundary } from '../controllers/gisController';

const router = Router();

// GIS endpoints require authentication.
router.use(requireAuth);
router.use(apiRateLimiter);

// Sprint 4: New GIS endpoints
router.get('/village/:villageName', getVillagePlots);
router.get('/plot/:khasraNumber', getPlotByKhasraRoute);

// Legacy placeholder routes (kept for backward compatibility)
router.get('/boundary', getPlotBoundary);

export default router;
