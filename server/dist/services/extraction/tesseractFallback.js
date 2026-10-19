"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWithTesseract = extractWithTesseract;
const tesseract_js_1 = __importDefault(require("tesseract.js"));
// Default low confidence for Tesseract results
const TESSERACT_CONFIDENCE = 0.4;
/**
 * Extracts text from a land record image using Tesseract.js (fallback)
 * Returns best-effort field extraction with low confidence scores
 * @param imageBuffer - The image file as Buffer
 * @returns Structured extraction result with low confidence values
 */
async function extractWithTesseract(imageBuffer) {
    try {
        // Convert buffer to base64 data URL for Tesseract
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;
        console.log('[Tesseract] Starting OCR extraction...');
        // Perform OCR
        const { data } = await tesseract_js_1.default.recognize(dataUrl, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`[Tesseract] Progress: ${(m.progress * 100).toFixed(0)}%`);
                }
            },
        });
        const rawText = data.text || '';
        console.log(`[Tesseract] Extracted raw text (${rawText.length} chars)`);
        // Best-effort field extraction using regex patterns
        const extractField = (text, patterns) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
            return null;
        };
        // Extract fields with simple regex patterns
        const ownerName = extractField(rawText, [
            /(?:owner|malik|name)[\s:]*([^\n,;]+)/i,
            /^([A-Z][a-z]+ [A-Z][a-z]+)$/m,
        ]);
        const khasraNumber = extractField(rawText, [
            /(?:khasra|plot|field)[\s:]*(?:no\.?|#)?[\s]*([0-9/\-]+)/i,
            /^([0-9]{1,4}\/[0-9]{1,4})$/m,
        ]);
        const plotArea = extractField(rawText, [
            /(?:area|size|plot)[\s:]*([0-9.]+\s*(?:acre|hectare|bigha))/i,
            /([0-9.]+\s*(?:ha|ac|bigha))/i,
        ]);
        const village = extractField(rawText, [
            /(?:village|gram)[\s:]*([^\n,;]+)/i,
        ]);
        const district = extractField(rawText, [
            /(?:district|tehsil)[\s:]*([^\n,;]+)/i,
        ]);
        const landClass = extractField(rawText, [
            /(?:class|type|category)[\s:]*([^\n,;]+)/i,
            /(?:agricultural|residential|commercial)/i,
        ]);
        return {
            ownerName: { value: ownerName, confidence: TESSERACT_CONFIDENCE },
            khasraNumber: { value: khasraNumber, confidence: TESSERACT_CONFIDENCE },
            plotArea: { value: plotArea, confidence: TESSERACT_CONFIDENCE },
            village: { value: village, confidence: TESSERACT_CONFIDENCE },
            district: { value: district, confidence: TESSERACT_CONFIDENCE },
            landClass: { value: landClass, confidence: TESSERACT_CONFIDENCE },
        };
    }
    catch (error) {
        console.error('[Tesseract] Extraction error:', error);
        // Return null values on error instead of throwing
        return {
            ownerName: { value: null, confidence: 0 },
            khasraNumber: { value: null, confidence: 0 },
            plotArea: { value: null, confidence: 0 },
            village: { value: null, confidence: 0 },
            district: { value: null, confidence: 0 },
            landClass: { value: null, confidence: 0 },
        };
    }
}
exports.default = {
    extractWithTesseract,
    TESSERACT_CONFIDENCE,
};
