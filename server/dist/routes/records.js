"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recordsController_1 = require("../controllers/recordsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, recordsController_1.listRecords);
router.get('/:id', auth_1.requireAuth, recordsController_1.getRecordById);
// TODO: Update role to 'reviewer' once reviewer workflow is implemented in Sprint 2
router.patch('/:id', auth_1.requireAuth, recordsController_1.updateRecord);
exports.default = router;
