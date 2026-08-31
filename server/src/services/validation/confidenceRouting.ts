import { env } from '../../config/env';
import { ExtractionResult } from '../extraction/geminiExtract';

export type RoutingStatus = 'needs_review' | 'auto_approved';

/**
 * Routes extracted record based on confidence thresholds and validation flags
 * @param extractedFields - Extracted field values with confidence scores
 * @param validationFlags - Any validation issues found
 * @param confidenceThreshold - Minimum confidence score (default from env.CONFIDENCE_THRESHOLD)
 * @returns Routing status: "needs_review" or "auto_approved"
 */
export function routeByConfidence(
  extractedFields: ExtractionResult,
  validationFlags: string[],
  confidenceThreshold: number = env.CONFIDENCE_THRESHOLD,
): RoutingStatus {
  // If any validation flags present, route to review
  if (validationFlags.length > 0) {
    console.log(`[Routing] Validation flags detected: ${validationFlags.join(', ')} → needs_review`);
    return 'needs_review';
  }

  // Check each field's confidence against threshold
  const fieldNames = ['ownerName', 'khasraNumber', 'plotArea', 'village', 'district', 'landClass'] as const;

  for (const fieldName of fieldNames) {
    const field = extractedFields[fieldName];
    if (field && field.confidence < confidenceThreshold) {
      console.log(
        `[Routing] ${fieldName} confidence (${field.confidence.toFixed(2)}) below threshold (${confidenceThreshold}) → needs_review`,
      );
      return 'needs_review';
    }
  }

  // If any field is null (not extracted), route to review
  for (const fieldName of fieldNames) {
    const field = extractedFields[fieldName];
    if (!field || field.value === null) {
      console.log(`[Routing] ${fieldName} is null (not extracted) → needs_review`);
      return 'needs_review';
    }
  }

  console.log('[Routing] All confidence checks passed → auto_approved');
  return 'auto_approved';
}

/**
 * Legacy function for backward compatibility (placeholder)
 */
export const evaluateConfidenceRoute = async (record: any): Promise<boolean> => {
  console.log(`[Validation Service] Rating confidence: OCR=${record.confidenceScore.ocrOverall}, LLM=${record.confidenceScore.llmOverall}`);
  const CONFIDENCE_THRESHOLD = 0.85;
  return record.confidenceScore.combined < CONFIDENCE_THRESHOLD;
};

export default {
  routeByConfidence,
  evaluateConfidenceRoute,
};
