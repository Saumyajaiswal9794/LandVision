import { Router } from 'express';
import { runConsistencyCheck } from '../controllers/validationController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/check', requireAuth, runConsistencyCheck);

export default router;
