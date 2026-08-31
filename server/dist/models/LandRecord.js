"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandRecord = void 0;
const mongoose_1 = require("mongoose");
const ExtractedFieldSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    rawValue: { type: String, required: true },
    inferredValue: { type: mongoose_1.Schema.Types.Mixed, required: true },
    confidence: { type: Number, required: true },
    boundingBox: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
    },
});
const LandRecordSchema = new mongoose_1.Schema({
    documentId: { type: String, required: true, index: true },
    khataNumber: { type: String, required: true, index: true },
    khasraNumber: { type: String, required: true, index: true },
    khatoniNumber: { type: String, required: true, index: true },
    owners: [{ type: String, required: true }],
    areaTotal: { type: Number, required: true },
    areaUnit: {
        type: String,
        enum: ['HECTARE', 'ACRE', 'BIGHA', 'KILLA', 'MARLA'],
        required: true,
    },
    district: { type: String, required: true },
    tehsil: { type: String, required: true },
    village: { type: String, required: true },
    state: { type: String, required: true },
    extractedFields: [ExtractedFieldSchema],
    confidenceScore: {
        ocrOverall: { type: Number, required: true },
        llmOverall: { type: Number, required: true },
        combined: { type: Number, required: true },
    },
    reviewStatus: {
        type: String,
        enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
        index: true,
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: String, default: null },
    gisPlotId: { type: String, default: null },
}, {
    timestamps: true,
    toJSON: {
        transform: (_, ret) => {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        },
    },
});
exports.LandRecord = (0, mongoose_1.model)('LandRecord', LandRecordSchema);
exports.default = exports.LandRecord;
