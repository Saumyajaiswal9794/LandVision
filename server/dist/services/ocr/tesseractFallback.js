"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performTesseractOCR = void 0;
/**
 * Performs local Tesseract OCR on a document when cloud OCR (Google Vision) fails.
 */
const performTesseractOCR = async (documentUrl) => {
    // Placeholder: Real integration executes local Tesseract bindings
    console.log(`[Tesseract OCR Fallback] Processing document: ${documentUrl}`);
    // Mocked output matching types contract
    return [
        {
            name: 'khataNumber',
            rawValue: '१२३/४५',
            inferredValue: '123/45',
            confidence: 0.81, // Typically lower confidence than Google Cloud Vision
            boundingBox: { x: 12, y: 14, width: 48, height: 22 },
        },
    ];
};
exports.performTesseractOCR = performTesseractOCR;
exports.default = exports.performTesseractOCR;
