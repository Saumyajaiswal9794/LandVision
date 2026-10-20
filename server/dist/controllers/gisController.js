"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlotBoundary = exports.getPlotByKhasraRoute = exports.getVillagePlots = void 0;
const plotQueries_1 = require("../services/gis/plotQueries");
// Sprint 4: Get all plots for a village as GeoJSON FeatureCollection
const getVillagePlots = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { villageName } = req.params;
        if (!villageName) {
            res.status(400).json({ error: 'villageName is required' });
            return;
        }
        const featureCollection = await (0, plotQueries_1.getPlotsByVillage)(villageName);
        res.status(200).json(featureCollection);
    }
    catch (error) {
        console.error('getVillagePlots error:', error);
        res.status(500).json({ error: error.message });
    }
};
exports.getVillagePlots = getVillagePlots;
// Sprint 4: Get a single plot by khasra number
const getPlotByKhasraRoute = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { khasraNumber } = req.params;
        const village = req.query.village;
        if (!khasraNumber) {
            res.status(400).json({ error: 'khasraNumber is required' });
            return;
        }
        if (!village) {
            res.status(400).json({ error: 'village query parameter is required' });
            return;
        }
        const feature = await (0, plotQueries_1.getPlotByKhasra)(khasraNumber, village);
        if (!feature) {
            res.status(404).json({ error: 'Plot not found' });
            return;
        }
        res.status(200).json(feature);
    }
    catch (error) {
        console.error('getPlotByKhasraRoute error:', error);
        res.status(500).json({ error: error.message });
    }
};
exports.getPlotByKhasraRoute = getPlotByKhasraRoute;
// Legacy placeholder (kept for backward compatibility)
const getPlotBoundary = async (req, res) => {
    try {
        const { khasraNumber, village } = req.query;
        res.status(200).json({
            khasraNumber,
            village,
            boundary: {
                type: 'Polygon',
                coordinates: [
                    [77.1025, 28.7041],
                    [77.1035, 28.7041],
                    [77.1035, 28.7051],
                    [77.1025, 28.7051],
                    [77.1025, 28.7041],
                ],
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPlotBoundary = getPlotBoundary;
