import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadDocument, getDocumentStatus, triggerExtraction } from '../controllers/documentsController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

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
const multerErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
      return;
    } else if (err.code === 'LIMIT_FILE_SIZE') {
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

// Secure document operations with auth middleware
router.post('/upload', requireAuth, requireRole(['officer']), upload.single('file'), multerErrorHandler, uploadDocument);
router.get('/:id/status', requireAuth, getDocumentStatus);

// Sprint 2: AI extraction trigger (officers can trigger, reviewers can also view results)
router.post('/:id/extract', requireAuth, triggerExtraction);

export default router;
