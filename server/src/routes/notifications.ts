import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { Request, Response } from 'express';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(requireAuth);
router.use(apiRateLimiter);

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const notifications = await Notification.findByUser(user.id, 50);
    res.status(200).json({ notifications });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const notification = await Notification.markRead(id, user.id);
    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.status(200).json({ notification });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await Notification.markAllRead(user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
