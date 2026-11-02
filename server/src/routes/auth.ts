import { Router } from 'express';
import { getProfile, syncUser } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { loginRateLimiter, apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(apiRateLimiter);
router.get('/profile', requireAuth, getProfile);
router.get('/me', requireAuth, getProfile);
router.post('/sync', requireAuth, loginRateLimiter, syncUser);

export default router;
