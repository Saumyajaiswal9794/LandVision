"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlotBoundary = exports.getPlotBoundary = void 0;
const getPlotBoundary = async (req, res) => {
    try {
        const { khasraNumber, village } = req.query;
        res.status(200).json({
            khasraNumber,
            village,
            boundary: {
                type: 'Polygon',
                coordinates: [
                    [
                        [77.1025, 28.7041],
                        [77.1035, 28.7041],
                        [77.1035, 28.7051],
                        [77.1025, 28.7051],
                        [77.1025, 28.7041],
                    ],
                ],
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPlotBoundary = getPlotBoundary;
const updatePlotBoundary = async (req, res) => {
    try {
        res.status(200).json({
            message: 'Plot boundaries updated successfully',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updatePlotBoundary = updatePlotBoundary;
