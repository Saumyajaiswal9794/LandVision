"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLandRecord = extractLandRecord;
const geminiExtract_1 = require("./geminiExtract");
const tesseractFallback_1 = require("./tesseractFallback");
// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
/**
 * Orchestrates extraction: tries Gemini first (with internal 429 backoff +
 * zod retries), falls back to Tesseract on any failure.
 *
 * Returns one row per plot visible on the page — the orchestrator's caller
 * is responsible for persisting ONE LandRecord per row, with documentId /
 * rowIndex / pageNo / extractionSource propagated from each row.
 *
 * @param imageBuffer  The image file as Buffer.
 * @param mimeType     MIME type (image/jpeg, image/png, ...).
 * @param pageNo       1-based page number this image corresponds to.
 *                     Defaults to 1 for single-page uploads.
 */
async function extractLandRecord(imageBuffer, mimeType, pageNo = 1) {
    // -----------------------------------------------------------------------
    // Try Gemini first — multi-row structured output.
    // -----------------------------------------------------------------------
    try {
        console.log(`[Extraction] Attempting Gemini extraction (page ${pageNo})...`);
        const geminiResult = await (0, geminiExtract_1.extractWithGemini)(imageBuffer, mimeType, pageNo);
        const rows = geminiResult.rows.map((row, idx) => ({
            ...row,
            rowIndex: idx,
            pageNo: geminiResult.pageNo,
            extractionSource: 'gemini',
        }));
        console.log(`[Extraction] Gemini succeeded — ${rows.length} row(s) extracted (page ${pageNo}).`);
        return {
            rows,
            extractionSource: 'gemini',
        };
    }
    catch (error) {
        const isRateLimit = error instanceof geminiExtract_1.GeminiRateLimitError;
        const isGeminiError = error instanceof geminiExtract_1.GeminiError;
        if (isRateLimit) {
            console.warn(`[Extraction] Gemini rate limit (429) exhausted after 3 backoff attempts — falling back to Tesseract...`);
        }
        else if (isGeminiError) {
            console.warn(`[Extraction] Gemini error after retries: ${error.message} — falling back to Tesseract...`);
        }
        else {
            console.warn(`[Extraction] Unexpected error during Gemini extraction: ${error.message} — falling back to Tesseract...`);
        }
        // -----------------------------------------------------------------------
        // Fallback: Tesseract — single best-effort row, lower confidence.
        // -----------------------------------------------------------------------
        try {
            console.log('[Extraction] Starting Tesseract fallback...');
            const tesseractResult = await (0, tesseractFallback_1.extractWithTesseract)(imageBuffer, pageNo);
            const rows = tesseractResult.rows.map((row, idx) => ({
                ...row,
                rowIndex: idx,
                pageNo: tesseractResult.pageNo,
                extractionSource: 'tesseract',
            }));
            console.log(`[Extraction] Tesseract fallback succeeded — ${rows.length} row(s) (page ${pageNo}).`);
            return {
                rows,
                extractionSource: 'tesseract',
            };
        }
        catch (tesseractError) {
            console.error('[Extraction] Tesseract fallback also failed:', tesseractError);
            throw new Error(`Both Gemini and Tesseract extraction failed. ` +
                `Gemini: ${error.message}. ` +
                `Tesseract: ${tesseractError.message}.`);
        }
    }
}
exports.default = {
    extractLandRecord,
};
