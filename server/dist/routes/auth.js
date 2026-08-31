"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/profile', auth_1.requireAuth, authController_1.getProfile);
router.post('/sync', auth_1.requireAuth, authController_1.syncUser);
exports.default = router;
