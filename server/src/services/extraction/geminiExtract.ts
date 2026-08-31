import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';

// Custom error class for Gemini rate limits
export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

// Custom error class for other Gemini errors
export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

// Expected extraction result structure
export interface ExtractionResult {
  ownerName: { value: string | null; confidence: number };
  khasraNumber: { value: string | null; confidence: number };
  plotArea: { value: string | null; confidence: number };
  village: { value: string | null; confidence: number };
  district: { value: string | null; confidence: number };
  landClass: { value: string | null; confidence: number };
}

const EXTRACTION_PROMPT = `
You are an expert at extracting structured data from land ownership documents (Khasra, Khata, Khatoni records).

Analyze the provided land record document image and extract the following fields:
- ownerName: The name of the land owner
- khasraNumber: The Khasra/plot number
- plotArea: The area of the plot (include unit if present)
- village: The name of the village
- district: The name of the district
- landClass: The class/type of land (e.g., agricultural, residential)

Return ONLY a valid JSON object with this exact structure (no markdown, no explanations):
{
  "ownerName": { "value": "<extracted value or null>", "confidence": <0-1 number> },
  "khasraNumber": { "value": "<extracted value or null>", "confidence": <0-1 number> },
  "plotArea": { "value": "<extracted value or null>", "confidence": <0-1 number> },
  "village": { "value": "<extracted value or null>", "confidence": <0-1 number> },
  "district": { "value": "<extracted value or null>", "confidence": <0-1 number> },
  "landClass": { "value": "<extracted value or null>", "confidence": <0-1 number> }
}

For each field:
- Set confidence to a number between 0 and 1 based on how clearly the value appears in the document
- Use 0.9+ for very clear text
- Use 0.5-0.9 for text that requires some interpretation
- Use <0.5 or null for values that cannot be found or are unclear
- Always return the JSON structure, never return markdown code blocks
`;

/**
 * Extracts data from a land record image using Gemini API
 * @param imageBuffer - The image file as Buffer
 * @param mimeType - MIME type of the image (e.g., "image/jpeg")
 * @returns Structured extraction result
 * @throws GeminiRateLimitError on 429 rate limit
 * @throws GeminiError on other API errors
 */
export async function extractWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  try {
    if (!env.GEMINI_API_KEY) {
      throw new GeminiError('GEMINI_API_KEY not configured');
    }

    // New @google/genai SDK: GoogleGenAI replaces GoogleGenerativeAI
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    // Convert image buffer to base64
    const base64Image = imageBuffer.toString('base64');

    // Call Gemini with the image and extraction prompt using new SDK shape
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const responseText = response.text ?? '';

    // Strip markdown code fences if present
    let jsonText = responseText
      .replace(/^```json\n?/, '') // Remove leading ```json
      .replace(/^```\n?/, '')     // Remove leading ```
      .replace(/\n?```$/, '');    // Remove trailing ```

    // Parse JSON
    let result: ExtractionResult;
    try {
      result = JSON.parse(jsonText);
    } catch (parseError) {
      throw new GeminiError(`Failed to parse Gemini response as JSON: ${jsonText}`);
    }

    // Validate result structure
    const requiredFields = ['ownerName', 'khasraNumber', 'plotArea', 'village', 'district', 'landClass'];
    for (const field of requiredFields) {
      if (!result[field as keyof ExtractionResult]) {
        throw new GeminiError(`Missing required field in response: ${field}`);
      }
    }

    return result;
  } catch (error) {
    if (error instanceof GeminiRateLimitError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a rate limit error (new SDK may use status codes or string "RESOURCE_EXHAUSTED")
    if (
      errorMessage.includes('429') ||
      errorMessage.toLowerCase().includes('rate limit') ||
      errorMessage.toLowerCase().includes('resource_exhausted') ||
      errorMessage.toLowerCase().includes('quota')
    ) {
      throw new GeminiRateLimitError(`Gemini API rate limit: ${errorMessage}`);
    }

    // Re-throw if already a GeminiError
    if (error instanceof GeminiError) {
      throw error;
    }

    // Wrap other errors
    throw new GeminiError(`Gemini extraction failed: ${errorMessage}`);
  }
}

export default {
  extractWithGemini,
  GeminiError,
  GeminiRateLimitError,
};
