import { Router } from 'express';
import { getProfile, syncUser } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/profile', requireAuth, getProfile);
router.post('/sync', requireAuth, syncUser);

export default router;
