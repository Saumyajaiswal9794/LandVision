"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recordsController_1 = require("../controllers/recordsController");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const router = (0, express_1.Router)();
// Sprint D: GET /api/records?documentId=... — list rows (optionally
// filtered by documentId or status). Open to any authenticated user.
router.get('/', auth_1.requireAuth, recordsController_1.listRecords);
// Sprint D: GET /api/records/:id — single row detail.
router.get('/:id', auth_1.requireAuth, recordsController_1.getRecordById);
// Sprint D: PATCH /api/records/:id — edit a single field of a row.
// Reviewer-only by default; officers may PATCH their own uploads (the
// controller enforces the uploadedBy === userId check).
router.patch('/:id', auth_1.requireAuth, (0, rbac_1.requireRole)(['officer', 'reviewer']), recordsController_1.updateRecord);
exports.default = router;
