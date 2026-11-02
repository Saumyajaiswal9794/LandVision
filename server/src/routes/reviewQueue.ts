import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ReviewQueue } from '../models/ReviewQueue';
import { LandRecord } from '../models/LandRecord';
import { Request, Response } from 'express';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['reviewer', 'admin']));

router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await ReviewQueue.findOpen();

    const enriched = await Promise.all(
      items.map(async (item) => {
        const record = await LandRecord.findById(item.landRecordId);
        return {
          ...item,
          record,
        };
      })
    );
    
    res.status(200).json({ queue: enriched });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const item = await ReviewQueue.assign(id, user.id);
    if (!item) {
      res.status(404).json({ error: 'Queue item not found' });
      return;
    }
    res.status(200).json({ item });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await ReviewQueue.complete(id);
    if (!item) {
      res.status(404).json({ error: 'Queue item not found' });
      return;
    }
    res.status(200).json({ item });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
