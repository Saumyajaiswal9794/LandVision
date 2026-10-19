"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performGoogleVisionOCR = void 0;
/**
 * Performs Google Cloud Vision OCR on a document stored at the given URL.
 * Extracted fields contain raw text segments and positional bounding box coordinates.
 */
const performGoogleVisionOCR = async (documentUrl) => {
    // Placeholder: Real integration uses Google Cloud Vision client library
    console.log(`[GoogleVision OCR] Processing document: ${documentUrl}`);
    // Mocked output matching types contract
    return [
        {
            name: 'khataNumber',
            rawValue: '१२३/४५',
            inferredValue: '123/45',
            confidence: 0.98,
            boundingBox: { x: 10, y: 15, width: 50, height: 20 },
        },
        {
            name: 'owners',
            rawValue: 'राम लाल, श्याम लाल',
            inferredValue: ['Ram Lal', 'Shyam Lal'],
            confidence: 0.92,
            boundingBox: { x: 10, y: 40, width: 150, height: 25 },
        },
    ];
};
exports.performGoogleVisionOCR = performGoogleVisionOCR;
exports.default = exports.performGoogleVisionOCR;
