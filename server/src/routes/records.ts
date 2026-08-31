import { Router } from 'express';
import { getRecordById, updateRecord, listRecords } from '../controllers/recordsController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', requireAuth, listRecords);
router.get('/:id', requireAuth, getRecordById);
// TODO: Update role to 'reviewer' once reviewer workflow is implemented in Sprint 2
router.patch('/:id', requireAuth, updateRecord);

export default router;
