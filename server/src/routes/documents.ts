import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadDocument, getDocumentStatus, triggerExtraction, listDocuments, getDocumentDetail, reviewDocument } from '../controllers/documentsController';
import { uploadRateLimiter, extractRateLimiter, apiRateLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

router.use(requireAuth);
router.use(apiRateLimiter);

// Multer configuration for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image/* and application/pdf only
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  },
});

// Multer error handler middleware
//
// `multer.MulterError.code` is typed as a strict union (`ErrorCode`):
//   "LIMIT_PART_COUNT" | "LIMIT_FILE_SIZE" | "LIMIT_FILE_COUNT" |
//   "LIMIT_FIELD_KEY" | "LIMIT_FIELD_VALUE" | "LIMIT_FIELD_COUNT" |
//   "LIMIT_UNEXPECTED_FILE"
//
// The previously-present `err.code === 'FILE_TOO_LARGE'` branch was a dead
// comparison — 'FILE_TOO_LARGE' is NOT a member of `ErrorCode` and would
// never match. It also triggered TS2367 because the literal had no overlap
// with the union. Removed; the actual file-size-exceeded case is handled by
// `LIMIT_FILE_SIZE` below.
const multerErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
      return;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ error: 'Too many files.' });
      return;
    } else {
      res.status(400).json({ error: err.message || 'File upload error.' });
      return;
    }
  } else if (err) {
    // Non-multer errors (e.g., from fileFilter)
    res.status(400).json({ error: err.message || 'File upload error.' });
    return;
  }
  next();
};

// Sprint 3: List all documents (role-filtered) — MUST be before /:id routes
router.get('/', listDocuments);

// Sprint 3: Get full document detail
router.get('/:id', getDocumentDetail);

// Sprint 3: Review action (reviewer-only)
router.patch(
  '/:id/review',
  requireRole(['reviewer']),
  auditLogger('document.review', 'document'),
  reviewDocument,
);

// Extraction status endpoint
router.get('/:id/extraction-status', getDocumentStatus);

// Sprint 1: Upload document (officer-only)
router.post(
  '/upload',
  requireRole(['officer']),
  uploadRateLimiter,
  upload.single('file'),
  multerErrorHandler,
  auditLogger('document.upload', 'document'),
  uploadDocument,
);

// Sprint 1-2: Legacy status and extraction routes
router.get('/:id/status', getDocumentStatus);
router.post('/:id/extract', extractRateLimiter, auditLogger('document.extract', 'document'), triggerExtraction);

export default router;
