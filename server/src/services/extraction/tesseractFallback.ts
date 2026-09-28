import Tesseract from 'tesseract.js';
import { BoundingBox, ExtractedField } from '@landvision/types';
import {
  ConvertedRow,
  GeminiExtractedField,
} from './geminiExtract';

// Default low confidence for Tesseract results.
export const TESSERACT_CONFIDENCE = 0.4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Tesseract.js word-level bbox `{ x0, y0, x1, y1 }` (in pixels,
 * with the origin at the top-left) into LandVision's normalised
 * `BoundingBox` (0-1, x/y/width/height).
 */
function tesseractBboxToBoundingBox(
  word: { bbox?: { x0: number; y0: number; x1: number; y1: number } },
  imageWidth: number,
  imageHeight: number,
  pageNo: number,
): BoundingBox | undefined {
  if (!word.bbox || !imageWidth || !imageHeight) return undefined;
  const { x0, y0, x1, y1 } = word.bbox;
  const x = x0 / imageWidth;
  const y = y0 / imageHeight;
  const width = (x1 - x0) / imageWidth;
  const height = (y1 - y0) / imageHeight;
  return {
    x,
    y,
    width,
    height,
    pageNo,
  };
}

/**
 * Find the first Tesseract word whose text matches `value` (case-insensitive,
 * trimmed) and return its bbox. Returns undefined when no match is found.
 */
function findWordBbox(
  value: string | null,
  words: Tesseract.Word[],
  imageWidth: number,
  imageHeight: number,
  pageNo: number,
): BoundingBox | undefined {
  if (!value || !words || words.length === 0) return undefined;
  const needle = value.trim().toLowerCase();
  // Try a direct match first.
  for (const w of words) {
    if (w.text && w.text.trim().toLowerCase() === needle) {
      const bbox = tesseractBboxToBoundingBox(w, imageWidth, imageHeight, pageNo);
      if (bbox) return bbox;
    }
  }
  // Fallback: try to find the word containing the first numeric token.
  // Useful for khasra numbers like "102/1" — Tesseract might split them
  // across two words ("102", "/", "1") and we want to attach a bbox to
  // at least the first matching token.
  const firstToken = needle.split(/[\s/]+/)[0];
  if (firstToken && firstToken.length >= 2) {
    for (const w of words) {
      if (w.text && w.text.trim().toLowerCase().includes(firstToken)) {
        const bbox = tesseractBboxToBoundingBox(w, imageWidth, imageHeight, pageNo);
        if (bbox) return bbox;
      }
    }
  }
  return undefined;
}

/**
 * Build an `ExtractedField<string | null>` from a regex-extracted value,
 * attaching a bbox if we can find one in the Tesseract word list.
 */
function buildField(
  value: string | null,
  confidence: number,
  words: Tesseract.Word[],
  imageWidth: number,
  imageHeight: number,
  pageNo: number,
): ExtractedField<string | null> {
  const bbox = findWordBbox(value, words, imageWidth, imageHeight, pageNo);
  const result: ExtractedField<string | null> = {
    value,
    confidence: value ? confidence : 0,
    source: 'tesseract',
  };
  if (bbox) {
    result.bbox = bbox;
    result.rawText = value ?? undefined;
  }
  return result;
}

// Best-effort field extraction using regex patterns.
function extractField(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts text from a land record image using Tesseract.js (fallback path).
 *
 * Returns the SAME multi-row shape as the Gemini path — but as a single
 * best-effort row (Tesseract has no concept of "plot rows on a page", so
 * we collapse everything into one row).
 *
 * When the Tesseract result exposes word-level bounding boxes, each
 * ExtractedField carries a normalised BoundingBox pointing at the word
 * that matched. Otherwise the bbox field is left undefined.
 *
 * @param imageBuffer - The image file as Buffer
 * @param pageNo     - 1-based page number (for bbox.pageNo annotation)
 * @returns          - Multi-row result with a single best-effort row.
 */
export async function extractWithTesseract(
  imageBuffer: Buffer,
  pageNo: number = 1,
): Promise<{ rows: ConvertedRow[]; pageNo: number }> {
  try {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    console.log('[Tesseract] Starting OCR extraction...');

    const { data } = await Tesseract.recognize(dataUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[Tesseract] Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });

    const rawText = data.text || '';
    console.log(`[Tesseract] Extracted raw text (${rawText.length} chars)`);

    // Tesseract.js exposes words[] with bbox info; fall back to image dims
    // from the OCR result if available.
    const words = (data as unknown as { words?: Tesseract.Word[] }).words ?? [];
    const imageWidth = (data as unknown as { imageWidth?: number }).imageWidth || 1000;
    const imageHeight = (data as unknown as { imageHeight?: number }).imageHeight || 1000;

    const ownerName = extractField(rawText, [
      /(?:owner|malik|name|स्वामी)[\s:]*([^\n,;]+)/i,
      /^([A-Z][a-z]+ [A-Z][a-z]+)$/m,
    ]);
    const khasraNumber = extractField(rawText, [
      /(?:khasra|plot|field|खसरा)[\s:]*(?:no\.?|#)?[\s]*([0-9/\-]+)/i,
      /^([0-9]{1,4}\/[0-9]{1,4})$/m,
    ]);
    const plotArea = extractField(rawText, [
      /(?:area|size|plot|क्षेत्र)[\s:]*([0-9.]+\s*(?:acre|hectare|bigha|एकड़|हेक्टेयर))/i,
      /([0-9.]+\s*(?:ha|ac|bigha))/i,
    ]);
    const village = extractField(rawText, [
      /(?:village|gram|गाँव|ग्राम)[\s:]*([^\n,;]+)/i,
    ]);
    const district = extractField(rawText, [
      /(?:district|tehsil|ज़िला|तहसील)[\s:]*([^\n,;]+)/i,
    ]);
    const landClass = extractField(rawText, [
      /(?:class|type|category|वर्ग)[\s:]*([^\n,;]+)/i,
      /(?:agricultural|residential|commercial|चाही|गैर मुमकिन)/i,
    ]);
    const tehsil = extractField(rawText, [
      /(?:tehsil|तहसील)[\s:]*([^\n,;]+)/i,
    ]);
    const khataNumber = extractField(rawText, [
      /(?:khata|खाता)[\s:]*(?:no\.?|#)?[\s]*([0-9/\-]+)/i,
    ]);
    const fatherOrHusbandName = extractField(rawText, [
      /(?:father|husband|पिता|पति|s\/o)[\s:]*([^\n,;]+)/i,
    ]);
    const subSurveyNumber = extractField(rawText, [
      /(?:sub[\s-]*survey|sub[\s-]*division|उप सर्वेक्षण)[\s:]*(?:no\.?|#)?[\s]*([0-9/\-]+)/i,
    ]);
    const remarks = extractField(rawText, [
      /(?:remarks|टिप्पणी)[\s:]*([^\n,;]+)/i,
    ]);

    // Build the single best-effort row.
    const row: ConvertedRow = {
      ownerName: buildField(ownerName, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo),
      khasraNumber: buildField(khasraNumber, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo),
      plotArea: buildField(plotArea, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo),
      village: buildField(village, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo),
      district: buildField(district, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo),
      landClass: buildField(landClass, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo),
      tehsil: tehsil
        ? buildField(tehsil, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo)
        : undefined,
      khataNumber: khataNumber
        ? buildField(khataNumber, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo)
        : undefined,
      fatherOrHusbandName: fatherOrHusbandName
        ? buildField(fatherOrHusbandName, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo)
        : undefined,
      subSurveyNumber: subSurveyNumber
        ? buildField(subSurveyNumber, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo)
        : undefined,
      remarks: remarks
        ? buildField(remarks, TESSERACT_CONFIDENCE, words, imageWidth, imageHeight, pageNo)
        : undefined,
    };

    return { rows: [row], pageNo };
  } catch (error) {
    console.error('[Tesseract] Extraction error:', error);

    // Return a single empty row — orchestrator will save one record with
    // all-null fields and a low confidence, so the record is visible in the
    // dashboard for human review instead of disappearing.
    const emptyRow: ConvertedRow = {
      ownerName: { value: null, confidence: 0, source: 'tesseract' },
      khasraNumber: { value: null, confidence: 0, source: 'tesseract' },
      plotArea: { value: null, confidence: 0, source: 'tesseract' },
      village: { value: null, confidence: 0, source: 'tesseract' },
      district: { value: null, confidence: 0, source: 'tesseract' },
      landClass: { value: null, confidence: 0, source: 'tesseract' },
    };
    return { rows: [emptyRow], pageNo };
  }
}

// ---------------------------------------------------------------------------
// Backward-compatibility shim — old `ExtractionResult` callers can keep using
// the old single-row shape. New code should use `extractWithTesseract` directly.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `extractWithTesseract()` instead — returns the multi-row
 * shape that matches the Gemini path. This thin shim flattens the single
 * Tesseract row back into the old flat shape for callers that haven't migrated.
 */
export async function extractWithTesseractLegacy(
  imageBuffer: Buffer,
): Promise<{
  ownerName: { value: string | null; confidence: number };
  khasraNumber: { value: string | null; confidence: number };
  plotArea: { value: string | null; confidence: number };
  village: { value: string | null; confidence: number };
  district: { value: string | null; confidence: number };
  landClass: { value: string | null; confidence: number };
}> {
  const result = await extractWithTesseract(imageBuffer, 1);
  const row = result.rows[0];
  return {
    ownerName: { value: row.ownerName.value, confidence: row.ownerName.confidence },
    khasraNumber: { value: row.khasraNumber.value, confidence: row.khasraNumber.confidence },
    plotArea: { value: row.plotArea.value, confidence: row.plotArea.confidence },
    village: { value: row.village.value, confidence: row.village.confidence },
    district: { value: row.district.value, confidence: row.district.confidence },
    landClass: { value: row.landClass.value, confidence: row.landClass.confidence },
  };
}

export default {
  extractWithTesseract,
  extractWithTesseractLegacy,
  TESSERACT_CONFIDENCE,
};
