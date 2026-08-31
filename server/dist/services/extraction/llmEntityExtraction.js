"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLandEntities = void 0;
/**
 * Extracts structured land record fields from raw OCR texts using an LLM (Claude/GPT).
 */
const extractLandEntities = async (rawOcrFields) => {
    // Placeholder: Real integration formats text as a prompt and queries Claude/OpenAI
    console.log(`[LLM Extraction] Extracting entities from ${rawOcrFields.length} raw fields`);
    // Mocked output matching types contract
    return rawOcrFields.map(field => ({
        ...field,
        confidence: field.confidence * 0.95, // Simulate combined confidence
    }));
};
exports.extractLandEntities = extractLandEntities;
exports.default = exports.extractLandEntities;
