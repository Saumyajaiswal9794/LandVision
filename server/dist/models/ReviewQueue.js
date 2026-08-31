"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewQueue = void 0;
const mongoose_1 = require("mongoose");
const ReviewQueueSchema = new mongoose_1.Schema({
    recordId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LandRecord', required: true, unique: true },
    assignedTo: { type: String, default: null, index: true },
    status: {
        type: String,
        enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
        index: true,
    },
    notes: [{ type: String }],
}, {
    timestamps: true,
});
exports.ReviewQueue = (0, mongoose_1.model)('ReviewQueue', ReviewQueueSchema);
exports.default = exports.ReviewQueue;
