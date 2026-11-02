import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { auditLogger } from '../middleware/auditLogger';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { getRecordById, updateRecord, listRecords } from '../controllers/recordsController';

const router = Router();

// All record endpoints require authentication; officers only see / edit
// their own uploads (enforced in the controller).
router.use(requireAuth);
router.use(apiRateLimiter);

// Sprint D: GET /api/records?documentId=... — list rows (optionally
// filtered by documentId or status). Open to any authenticated user.
router.get('/', listRecords);

// Sprint D: GET /api/records/:id — single row detail.
router.get('/:id', getRecordById);

// Sprint D: PATCH /api/records/:id — edit a single field of a row.
// Reviewer-only by default; officers may PATCH their own uploads (the
// controller enforces the uploadedBy === userId check).
router.patch('/:id', auditLogger('record.update', 'record'), updateRecord);

export default router;
