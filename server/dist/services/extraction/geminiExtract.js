"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiResponseSchema = exports.GeminiError = exports.GeminiRateLimitError = void 0;
exports.callGeminiOnce = callGeminiOnce;
exports.extractWithGemini = extractWithGemini;
const genai_1 = require("@google/genai");
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const bboxConverter_1 = require("./bboxConverter");
// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
/** Raised when Gemini returns 429 / RESOURCE_EXHAUSTED. Triggers backoff. */
class GeminiRateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GeminiRateLimitError';
    }
}
exports.GeminiRateLimitError = GeminiRateLimitError;
/** Raised for all other Gemini failures (parse errors, schema mismatches, network). */
class GeminiError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GeminiError';
    }
}
exports.GeminiError = GeminiError;
// ---------------------------------------------------------------------------
// Zod validation schema (used to validate Gemini's JSON-mode output).
// ---------------------------------------------------------------------------
const extractedFieldSchema = zod_1.z.object({
    value: zod_1.z.string().nullable(),
    confidence: zod_1.z.number().min(0).max(1),
    box_2d: zod_1.z
        .union([
        zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]),
        zod_1.z.array(zod_1.z.number()).length(4),
    ])
        .nullable()
        .optional(),
});
const rowSchema = zod_1.z.object({
    ownerName: extractedFieldSchema,
    khasraNumber: extractedFieldSchema,
    plotArea: extractedFieldSchema,
    village: extractedFieldSchema,
    district: extractedFieldSchema,
    landClass: extractedFieldSchema,
    khataNumber: extractedFieldSchema.optional(),
    tehsil: extractedFieldSchema.optional(),
    subSurveyNumber: extractedFieldSchema.optional(),
    fatherOrHusbandName: extractedFieldSchema.optional(),
    remarks: extractedFieldSchema.optional(),
});
exports.geminiResponseSchema = zod_1.z.object({
    rows: zod_1.z.array(rowSchema).min(1),
});
// ---------------------------------------------------------------------------
// Gemini structured-output (responseSchema) declaration.
// ---------------------------------------------------------------------------
/**
 * Structured-output schema sent to Gemini via `responseSchema` so the model
 * is FORCED to emit a JSON object matching our shape. We use the SDK's
 * `Type` enum (STRING/NUMBER/ARRAY/OBJECT) for OpenAPI 3.0 compatibility.
 *
 * Note: `box_2d` is declared as ARRAY of NUMBER with max 4 items. We can't
 * enforce the exact length, but zod catches violations on our side.
 */
const fieldSchemaObj = {
    type: genai_1.Type.OBJECT,
    properties: {
        value: { type: genai_1.Type.STRING, description: 'Extracted value, or empty string if unreadable.' },
        confidence: {
            type: genai_1.Type.NUMBER,
            description: 'Confidence 0.0-1.0. Below 0.4 means unreadable.',
        },
        box_2d: {
            type: genai_1.Type.ARRAY,
            description: '[ymin, xmin, ymax, xmax] normalised to 0-1000 relative to the image.',
            items: { type: genai_1.Type.NUMBER },
        },
    },
    required: ['value', 'confidence'],
};
const RESPONSE_SCHEMA = {
    type: genai_1.Type.OBJECT,
    properties: {
        rows: {
            type: genai_1.Type.ARRAY,
            description: 'One entry per plot row visible on the page.',
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    ownerName: fieldSchemaObj,
                    khasraNumber: fieldSchemaObj,
                    plotArea: fieldSchemaObj,
                    village: fieldSchemaObj,
                    district: fieldSchemaObj,
                    landClass: fieldSchemaObj,
                    khataNumber: fieldSchemaObj,
                    tehsil: fieldSchemaObj,
                    subSurveyNumber: fieldSchemaObj,
                    fatherOrHusbandName: fieldSchemaObj,
                    remarks: fieldSchemaObj,
                },
                required: ['ownerName', 'khasraNumber', 'plotArea', 'village', 'district', 'landClass'],
            },
        },
    },
    required: ['rows'],
};
// ---------------------------------------------------------------------------
// Extraction prompt — handles Hindi/Devanagari + Indic numerals + stamps.
// ---------------------------------------------------------------------------
const EXTRACTION_PROMPT = `
You are an expert at reading Indian land ownership records — Khasra,
Khatauni, Khata, and Patta documents written in English, Hindi (Devanagari),
or a mix of both. The image may contain one plot row or many plot rows on a
single page. Extract EVERY plot row visible.

For each row, extract these six required fields:
  - ownerName           — name of the land owner (यदि नाम हिंदी में है तो भी अंग्रेज़ी लिप्यंतरण में लिखें, जैसे "राम सिंह" → "Ram Singh")
  - khasraNumber         — Khasra / survey / plot number (देवनागरी अंकों को अंग्रेज़ी अंकों में बदलें: २३५ → 235)
  - plotArea             — area of the plot including unit (e.g. "1.85 हेक्टेयर" → "1.85 hectares")
  - village              — village name (गाँव का नाम)
  - district             — district name (ज़िला)
  - landClass            — class/type of land (e.g. "Chahi" / "चाही", "Gair Mumkin" / "गैर मुमकिन", "Agricultural", "Residential")

Optionally also extract (set to null if not visible):
  - khataNumber          — Khata register number
  - tehsil               — Tehsil / taluka
  - subSurveyNumber      — sub-survey / sub-division number
  - fatherOrHusbandName  — father's or husband's name (संबंध)
  - remarks              — any free-text remarks written against the row

For EVERY field on EVERY row, you MUST return:
  - value:    the extracted string (transliterated to Latin script for Hindi), or null
  - confidence: a number 0.0-1.0
  - box_2d:   [ymin, xmin, ymax, xmax] in the image's pixel grid NORMALISED to 0-1000
              (so for a 1920×1080 image, x_pixel = xmin/1000 * 1920).

CRITICAL RULES:
  1. If a field is unreadable, blurry, occluded by a stamp, or you would have to
     GUESS — return null with a confidence below 0.4. Do NOT invent values.
  2. IGNORE stamps, watermarks, margin scribbles, printed headers/footers, and
     any text NOT belonging to a specific plot row. Only return values that
     belong to a real plot row.
  3. Convert Devanagari numerals (०-९) to Latin (0-9) in all numeric fields.
  4. Convert Hindi field values to Latin transliteration — keep proper-noun
     spellings as they are commonly written (Ram Singh, not "राम सिंह").
  5. If a page has N plot rows, return exactly N entries in the rows array —
     never merge rows, never split a single row into two.
  6. box_2d coordinates are relative to the ORIGINAL image you are given —
     not a cropped or rotated version.

Return ONLY a JSON object of the form:
  { "rows": [ { "ownerName": {...}, "khasraNumber": {...}, ... }, ... ] }
`.trim();
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Sleep helper used for exponential backoff. */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Convert a GeminiExtractedField (with raw box_2d) into our ExtractedField shape. */
function convertField(field, pageNo) {
    if (!field) {
        return { value: null, confidence: 0, source: 'gemini' };
    }
    const bbox = field.box_2d
        ? (0, bboxConverter_1.geminiBoxToBoundingBox)(field.box_2d, pageNo)
        : null;
    const result = {
        value: field.value,
        confidence: typeof field.confidence === 'number' ? field.confidence : 0,
        source: 'gemini',
    };
    if (bbox) {
        result.bbox = bbox;
        result.rawText = field.value ?? undefined;
    }
    return result;
}
/** Convert the raw multi-row Gemini result into our internal ConvertedRow[] shape. */
function convertRows(parsed, pageNo) {
    return parsed.rows.map((row) => ({
        ownerName: convertField(row.ownerName, pageNo),
        khasraNumber: convertField(row.khasraNumber, pageNo),
        plotArea: convertField(row.plotArea, pageNo),
        village: convertField(row.village, pageNo),
        district: convertField(row.district, pageNo),
        landClass: convertField(row.landClass, pageNo),
        khataNumber: row.khataNumber ? convertField(row.khataNumber, pageNo) : undefined,
        tehsil: row.tehsil ? convertField(row.tehsil, pageNo) : undefined,
        subSurveyNumber: row.subSurveyNumber ? convertField(row.subSurveyNumber, pageNo) : undefined,
        fatherOrHusbandName: row.fatherOrHusbandName
            ? convertField(row.fatherOrHusbandName, pageNo)
            : undefined,
        remarks: row.remarks ? convertField(row.remarks, pageNo) : undefined,
    }));
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Calls Gemini ONCE with the image + structured-output schema and returns
 * the parsed + zod-validated multi-row result.
 *
 * Does NOT handle retries or backoff — the caller is responsible for that.
 *
 * @throws GeminiRateLimitError on 429 / RESOURCE_EXHAUSTED.
 * @throws GeminiError on parse failure, schema mismatch, or other API error.
 */
async function callGeminiOnce(imageBuffer, mimeType) {
    if (!env_1.env.GEMINI_API_KEY) {
        throw new GeminiError('GEMINI_API_KEY not configured');
    }
    const ai = new genai_1.GoogleGenAI({ apiKey: env_1.env.GEMINI_API_KEY });
    const base64Image = imageBuffer.toString('base64');
    let responseText;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                data: base64Image,
                                mimeType,
                            },
                        },
                        { text: EXTRACTION_PROMPT },
                    ],
                },
            ],
            config: {
                // Force JSON output — combined with responseSchema the SDK
                // guarantees the response is a JSON object matching our schema.
                responseMimeType: 'application/json',
                responseSchema: RESPONSE_SCHEMA,
                temperature: 0.1, // deterministic for OCR-grade extraction
            },
        });
        responseText = response.text ?? '';
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('429') ||
            msg.toLowerCase().includes('rate limit') ||
            msg.toLowerCase().includes('resource_exhausted') ||
            msg.toLowerCase().includes('quota')) {
            throw new GeminiRateLimitError(`Gemini API rate limit: ${msg}`);
        }
        throw new GeminiError(`Gemini API call failed: ${msg}`);
    }
    if (!responseText || responseText.trim().length === 0) {
        throw new GeminiError('Gemini returned an empty response body');
    }
    // Step 1: parse as JSON.
    let parsed;
    try {
        parsed = JSON.parse(responseText);
    }
    catch (parseError) {
        throw new GeminiError(`Failed to parse Gemini JSON response: ${parseError.message}. Body: ${responseText.slice(0, 200)}`);
    }
    // Step 2: validate against the zod schema.
    const zodResult = exports.geminiResponseSchema.safeParse(parsed);
    if (!zodResult.success) {
        const issues = zodResult.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new GeminiError(`Gemini response failed zod validation: ${issues}`);
    }
    return { rows: zodResult.data.rows };
}
/**
 * Gemini extraction with:
 *   - exponential backoff (3 attempts) on 429 / RESOURCE_EXHAUSTED
 *   - zod-schema retry up to 2 times on malformed output (re-prompting each time)
 *
 * Total worst-case attempts: 3 (backoff) × 3 (zod retries) = 9 Gemini calls.
 *
 * @param imageBuffer  The image bytes to send.
 * @param mimeType     MIME type (image/jpeg, image/png, etc.).
 * @param pageNo       1-based page number this image corresponds to.
 * @returns            Multi-row extraction output (rows + pageNo).
 *
 * @throws GeminiRateLimitError if all 3 backoff attempts return 429.
 * @throws GeminiError          if all zod retries fail or a non-429 error occurs.
 */
async function extractWithGemini(imageBuffer, mimeType, pageNo = 1) {
    // ---------------------------------------------------------------------
    // PHASE 1: 429 backoff — up to 3 attempts total (1 initial + 2 retries).
    // Exponential backoff: 1s, 2s, 4s between attempts.
    // ---------------------------------------------------------------------
    const MAX_BACKOFF_ATTEMPTS = 3;
    const backoffDelays = [1000, 2000, 4000];
    let lastRateLimitError = null;
    let parsed = null;
    for (let backoffAttempt = 0; backoffAttempt < MAX_BACKOFF_ATTEMPTS; backoffAttempt++) {
        try {
            // -----------------------------------------------------------------
            // PHASE 2: zod-schema retry — up to 2 retries for malformed output.
            // -----------------------------------------------------------------
            const MAX_ZOD_RETRIES = 2;
            let lastZodError = null;
            for (let zodAttempt = 0; zodAttempt <= MAX_ZOD_RETRIES; zodAttempt++) {
                try {
                    parsed = await callGeminiOnce(imageBuffer, mimeType);
                    break; // success
                }
                catch (err) {
                    if (err instanceof GeminiRateLimitError) {
                        // Re-throw to outer loop — backoff handles it.
                        throw err;
                    }
                    if (err instanceof GeminiError) {
                        lastZodError = err;
                        console.warn(`[Gemini] zod attempt ${zodAttempt + 1}/${MAX_ZOD_RETRIES + 1} failed: ${err.message}`);
                        if (zodAttempt < MAX_ZOD_RETRIES) {
                            await sleep(500 * (zodAttempt + 1));
                            continue;
                        }
                    }
                    else {
                        // Unknown error — wrap and re-throw.
                        throw new GeminiError(`Unexpected error during Gemini call: ${err.message}`);
                    }
                }
            }
            if (!parsed) {
                // All zod retries failed — let the caller fall back to Tesseract.
                throw lastZodError ?? new GeminiError('Gemini parsing failed after retries');
            }
            break; // success — exit backoff loop
        }
        catch (err) {
            if (err instanceof GeminiRateLimitError) {
                lastRateLimitError = err;
                if (backoffAttempt < MAX_BACKOFF_ATTEMPTS - 1) {
                    const delay = backoffDelays[backoffAttempt] ?? 4000;
                    console.warn(`[Gemini] 429 rate limit (attempt ${backoffAttempt + 1}/${MAX_BACKOFF_ATTEMPTS}). ` +
                        `Backing off for ${delay}ms before retry...`);
                    await sleep(delay);
                    continue;
                }
            }
            else {
                // Non-429 error — re-throw immediately, no backoff.
                throw err;
            }
        }
    }
    if (!parsed) {
        // Exhausted backoff — surface the rate-limit error so the orchestrator
        // can fall back to Tesseract.
        throw lastRateLimitError ?? new GeminiError('Gemini extraction failed');
    }
    const rows = convertRows(parsed, pageNo);
    return { rows, pageNo };
}
exports.default = {
    extractWithGemini,
    callGeminiOnce,
    GeminiError,
    GeminiRateLimitError,
    geminiResponseSchema: exports.geminiResponseSchema,
};
