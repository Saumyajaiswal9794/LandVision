import { Router } from 'express';
import { getRecordById, updateRecord, listRecords } from '../controllers/recordsController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// Sprint D: GET /api/records?documentId=... — list rows (optionally
// filtered by documentId or status). Open to any authenticated user.
router.get('/', requireAuth, listRecords);

// Sprint D: GET /api/records/:id — single row detail.
router.get('/:id', requireAuth, getRecordById);

// Sprint D: PATCH /api/records/:id — edit a single field of a row.
// Reviewer-only by default; officers may PATCH their own uploads (the
// controller enforces the uploadedBy === userId check).
router.patch('/:id', requireAuth, requireRole(['reviewer']), updateRecord);

export default router;
