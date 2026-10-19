"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLandRecord = extractLandRecord;
const geminiExtract_1 = require("./geminiExtract");
const tesseractFallback_1 = require("./tesseractFallback");
/**
 * Orchestrates extraction: tries Gemini first, falls back to Tesseract on errors
 * @param imageBuffer - The image file as Buffer
 * @param mimeType - MIME type of the image (e.g., "image/jpeg")
 * @returns Extraction result with source field
 */
async function extractLandRecord(imageBuffer, mimeType) {
    try {
        console.log('[Extraction] Attempting Gemini extraction...');
        const result = await (0, geminiExtract_1.extractWithGemini)(imageBuffer, mimeType);
        return {
            ...result,
            extractionSource: 'gemini',
        };
    }
    catch (error) {
        const isRateLimit = error instanceof geminiExtract_1.GeminiRateLimitError;
        const isGeminiError = error instanceof geminiExtract_1.GeminiError;
        if (isRateLimit) {
            console.warn('[Extraction] Gemini rate limit (429), falling back to Tesseract...');
        }
        else if (isGeminiError) {
            console.warn(`[Extraction] Gemini error: ${error.message}, falling back to Tesseract...`);
        }
        else {
            console.warn(`[Extraction] Unexpected error: ${error.message}, falling back to Tesseract...`);
        }
        // Fall back to Tesseract
        try {
            console.log('[Extraction] Starting Tesseract fallback...');
            const result = await (0, tesseractFallback_1.extractWithTesseract)(imageBuffer);
            return {
                ...result,
                extractionSource: 'tesseract',
            };
        }
        catch (tesseractError) {
            console.error('[Extraction] Tesseract fallback also failed:', tesseractError);
            throw new Error(`Both Gemini and Tesseract extraction failed. Gemini: ${error.message}, Tesseract: ${tesseractError.message}`);
        }
    }
}
exports.default = {
    extractLandRecord,
};
