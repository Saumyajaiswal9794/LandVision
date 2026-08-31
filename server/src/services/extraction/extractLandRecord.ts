import { extractWithGemini, GeminiRateLimitError, GeminiError, ExtractionResult } from './geminiExtract';
import { extractWithTesseract } from './tesseractFallback';

export interface ExtractedLandRecord extends ExtractionResult {
  extractionSource: 'gemini' | 'tesseract';
}

/**
 * Orchestrates extraction: tries Gemini first, falls back to Tesseract on errors
 * @param imageBuffer - The image file as Buffer
 * @param mimeType - MIME type of the image (e.g., "image/jpeg")
 * @returns Extraction result with source field
 */
export async function extractLandRecord(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ExtractedLandRecord> {
  try {
    console.log('[Extraction] Attempting Gemini extraction...');
    const result = await extractWithGemini(imageBuffer, mimeType);

    return {
      ...result,
      extractionSource: 'gemini',
    };
  } catch (error) {
    const isRateLimit = error instanceof GeminiRateLimitError;
    const isGeminiError = error instanceof GeminiError;

    if (isRateLimit) {
      console.warn('[Extraction] Gemini rate limit (429), falling back to Tesseract...');
    } else if (isGeminiError) {
      console.warn(`[Extraction] Gemini error: ${(error as Error).message}, falling back to Tesseract...`);
    } else {
      console.warn(`[Extraction] Unexpected error: ${(error as Error).message}, falling back to Tesseract...`);
    }

    // Fall back to Tesseract
    try {
      console.log('[Extraction] Starting Tesseract fallback...');
      const result = await extractWithTesseract(imageBuffer);

      return {
        ...result,
        extractionSource: 'tesseract',
      };
    } catch (tesseractError) {
      console.error('[Extraction] Tesseract fallback also failed:', tesseractError);
      throw new Error(
        `Both Gemini and Tesseract extraction failed. Gemini: ${(error as Error).message}, Tesseract: ${(tesseractError as Error).message}`,
      );
    }
  }
}

export default {
  extractLandRecord,
};
