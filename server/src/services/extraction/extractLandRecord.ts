import {
  extractWithGemini,
  GeminiRateLimitError,
  GeminiError,
  GeminiExtractionOutput,
  ConvertedRow,
} from './geminiExtract';
import { extractWithTesseract } from './tesseractFallback';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExtractedLandRecordRow extends ConvertedRow {
  /** 0-based row index within the source page (Gemini path) or 0 for Tesseract. */
  rowIndex: number;
  /** 1-based page number within the source document. */
  pageNo: number;
  /** Which extraction engine produced this row. */
  extractionSource: 'gemini' | 'tesseract';
}

export interface ExtractedLandRecord {
  rows: ExtractedLandRecordRow[];
  /** The extraction source for the dominant rows (gemini if any Gemini row
   *  succeeded, otherwise tesseract). */
  extractionSource: 'gemini' | 'tesseract';
}

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
export async function extractLandRecord(
  imageBuffer: Buffer,
  mimeType: string,
  pageNo: number = 1,
): Promise<ExtractedLandRecord> {
  // -----------------------------------------------------------------------
  // Try Gemini first — multi-row structured output.
  // -----------------------------------------------------------------------
  try {
    console.log(`[Extraction] Attempting Gemini extraction (page ${pageNo})...`);
    const geminiResult: GeminiExtractionOutput = await extractWithGemini(
      imageBuffer,
      mimeType,
      pageNo,
    );

    const rows: ExtractedLandRecordRow[] = geminiResult.rows.map((row, idx) => ({
      ...row,
      rowIndex: idx,
      pageNo: geminiResult.pageNo,
      extractionSource: 'gemini',
    }));

    console.log(
      `[Extraction] Gemini succeeded — ${rows.length} row(s) extracted (page ${pageNo}).`,
    );

    return {
      rows,
      extractionSource: 'gemini',
    };
  } catch (error) {
    const isRateLimit = error instanceof GeminiRateLimitError;
    const isGeminiError = error instanceof GeminiError;

    if (isRateLimit) {
      console.warn(
        `[Extraction] Gemini rate limit (429) exhausted after 3 backoff attempts — falling back to Tesseract...`,
      );
    } else if (isGeminiError) {
      console.warn(
        `[Extraction] Gemini error after retries: ${(error as Error).message} — falling back to Tesseract...`,
      );
    } else {
      console.warn(
        `[Extraction] Unexpected error during Gemini extraction: ${(error as Error).message} — falling back to Tesseract...`,
      );
    }

    // -----------------------------------------------------------------------
    // Fallback: Tesseract — single best-effort row, lower confidence.
    // -----------------------------------------------------------------------
    try {
      console.log('[Extraction] Starting Tesseract fallback...');
      const tesseractResult = await extractWithTesseract(imageBuffer, pageNo);

      const rows: ExtractedLandRecordRow[] = tesseractResult.rows.map((row, idx) => ({
        ...row,
        rowIndex: idx,
        pageNo: tesseractResult.pageNo,
        extractionSource: 'tesseract',
      }));

      console.log(
        `[Extraction] Tesseract fallback succeeded — ${rows.length} row(s) (page ${pageNo}).`,
      );

      return {
        rows,
        extractionSource: 'tesseract',
      };
    } catch (tesseractError) {
      console.error('[Extraction] Tesseract fallback also failed:', tesseractError);
      throw new Error(
        `Both Gemini and Tesseract extraction failed. ` +
          `Gemini: ${(error as Error).message}. ` +
          `Tesseract: ${(tesseractError as Error).message}.`,
      );
    }
  }
}

export default {
  extractLandRecord,
};
