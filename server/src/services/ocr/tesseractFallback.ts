import { ExtractedField } from '@landvision/types';

/**
 * Performs local Tesseract OCR on a document when cloud OCR (Google Vision) fails.
 */
export const performTesseractOCR = async (
  documentUrl: string,
): Promise<ExtractedField[]> => {
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
export default performTesseractOCR;
