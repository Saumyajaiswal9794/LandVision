"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validationController_1 = require("../controllers/validationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/check', auth_1.requireAuth, validationController_1.runConsistencyCheck);
exports.default = router;
