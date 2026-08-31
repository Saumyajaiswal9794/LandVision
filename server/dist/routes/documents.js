"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const documentsController_1 = require("../controllers/documentsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Secure document operations with auth middleware
router.post('/upload', auth_1.requireAuth, documentsController_1.uploadDocument);
router.get('/:id/status', auth_1.requireAuth, documentsController_1.getDocumentStatus);
exports.default = router;
