"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateConfidenceRoute = void 0;
/**
 * Evaluates the confidence scores of the extracted record.
 * Returns true if the record fails confidence threshold checks and needs manual (HITL) review.
 */
const evaluateConfidenceRoute = async (record) => {
    // Placeholder: Real integration tests scores against defined threshold envs
    console.log(`[Validation Service] Rating confidence: OCR=${record.confidenceScore.ocrOverall}, LLM=${record.confidenceScore.llmOverall}`);
    const CONFIDENCE_THRESHOLD = 0.85;
    return record.confidenceScore.combined < CONFIDENCE_THRESHOLD;
};
exports.evaluateConfidenceRoute = evaluateConfidenceRoute;
exports.default = exports.evaluateConfidenceRoute;
