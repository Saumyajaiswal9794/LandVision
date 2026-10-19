"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const documentsController_1 = require("../controllers/documentsController");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const router = (0, express_1.Router)();
// Multer configuration for file upload
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept image/* and application/pdf only
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
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
const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
            return;
        }
        else if (err.code === 'LIMIT_FILE_COUNT') {
            res.status(400).json({ error: 'Too many files.' });
            return;
        }
        else {
            res.status(400).json({ error: err.message || 'File upload error.' });
            return;
        }
    }
    else if (err) {
        // Non-multer errors (e.g., from fileFilter)
        res.status(400).json({ error: err.message || 'File upload error.' });
        return;
    }
    next();
};
// Sprint 3: List all documents (role-filtered) — MUST be before /:id routes
router.get('/', auth_1.requireAuth, documentsController_1.listDocuments);
// Sprint 3: Get full document detail
router.get('/:id', auth_1.requireAuth, documentsController_1.getDocumentDetail);
// Sprint 3: Review action (reviewer-only)
router.patch('/:id/review', auth_1.requireAuth, (0, rbac_1.requireRole)(['reviewer']), documentsController_1.reviewDocument);
// Sprint 1: Upload document (officer-only)
router.post('/upload', auth_1.requireAuth, (0, rbac_1.requireRole)(['officer']), upload.single('file'), multerErrorHandler, documentsController_1.uploadDocument);
// Sprint 1-2: Legacy status and extraction routes
router.get('/:id/status', auth_1.requireAuth, documentsController_1.getDocumentStatus);
router.post('/:id/extract', auth_1.requireAuth, documentsController_1.triggerExtraction);
exports.default = router;
