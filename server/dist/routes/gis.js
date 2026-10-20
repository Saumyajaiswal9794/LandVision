"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gisController_1 = require("../controllers/gisController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Sprint 4: New GIS endpoints
router.get('/village/:villageName', auth_1.requireAuth, gisController_1.getVillagePlots);
router.get('/plot/:khasraNumber', auth_1.requireAuth, gisController_1.getPlotByKhasraRoute);
// Legacy placeholder routes (kept for backward compatibility)
router.get('/boundary', auth_1.requireAuth, gisController_1.getPlotBoundary);
exports.default = router;
