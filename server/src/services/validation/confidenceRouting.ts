import { env } from '../../config/env';
import { ConvertedRow } from '../extraction/geminiExtract';

export type RoutingStatus = 'needs_review' | 'auto_approved';

/**
 * Routes a single extracted row based on confidence thresholds and validation
 * flags.
 *
 * In Sprint A/B we now extract potentially multiple rows per page, so this
 * function operates on ONE row at a time — the caller invokes it per row
 * when persisting LandRecords.
 *
 * @param row                  One extracted row from the orchestrator.
 * @param validationFlags      Validation issues found for this row.
 * @param confidenceThreshold  Minimum confidence (default from env).
 * @returns                    'needs_review' or 'auto_approved'.
 */
export function routeByConfidence(
  row: ConvertedRow,
  validationFlags: string[],
  confidenceThreshold: number = env.CONFIDENCE_THRESHOLD,
): RoutingStatus {
  // If any validation flags are present, route to review.
  if (validationFlags.length > 0) {
    console.log(
      `[Routing] Validation flags detected: ${validationFlags.join(', ')} → needs_review`,
    );
    return 'needs_review';
  }

  // The 6 required fields — check each one's confidence.
  const fieldNames = [
    'ownerName',
    'khasraNumber',
    'plotArea',
    'village',
    'district',
    'landClass',
  ] as const;

  for (const fieldName of fieldNames) {
    const field = row[fieldName];
    if (!field) {
      console.log(`[Routing] ${fieldName} missing → needs_review`);
      return 'needs_review';
    }
    if (field.confidence < confidenceThreshold) {
      console.log(
        `[Routing] ${fieldName} confidence (${field.confidence.toFixed(2)}) below threshold (${confidenceThreshold}) → needs_review`,
      );
      return 'needs_review';
    }
    if (field.value === null || field.value === undefined || field.value === '') {
      console.log(`[Routing] ${fieldName} is null/empty (not extracted) → needs_review`);
      return 'needs_review';
    }
  }

  console.log('[Routing] All confidence checks passed → auto_approved');
  return 'auto_approved';
}

// ---------------------------------------------------------------------------
// Legacy compatibility shim
// ---------------------------------------------------------------------------

/**
 * @deprecated Old single-row API kept around for callers that haven't been
 * migrated to the multi-row shape. Internally wraps `routeByConfidence` on
 * a synthesized `ConvertedRow`.
 *
 * Accepts the old shape: `{ ownerName: { value, confidence }, ... }` and
 * the validation flags array.
 */
export function routeByConfidenceLegacy(
  extractedFields: {
    ownerName?: { value: string | null; confidence: number };
    khasraNumber?: { value: string | null; confidence: number };
    plotArea?: { value: string | null; confidence: number };
    village?: { value: string | null; confidence: number };
    district?: { value: string | null; confidence: number };
    landClass?: { value: string | null; confidence: number };
  },
  validationFlags: string[],
  confidenceThreshold: number = env.CONFIDENCE_THRESHOLD,
): RoutingStatus {
  const row: ConvertedRow = {
    ownerName: (extractedFields.ownerName as any) ?? { value: null, confidence: 0 },
    khasraNumber: (extractedFields.khasraNumber as any) ?? { value: null, confidence: 0 },
    plotArea: (extractedFields.plotArea as any) ?? { value: null, confidence: 0 },
    village: (extractedFields.village as any) ?? { value: null, confidence: 0 },
    district: (extractedFields.district as any) ?? { value: null, confidence: 0 },
    landClass: (extractedFields.landClass as any) ?? { value: null, confidence: 0 },
  };
  return routeByConfidence(row, validationFlags, confidenceThreshold);
}

/**
 * Legacy async function kept for backward compatibility with old code paths
 * that still call `evaluateConfidenceRoute` on a record.
 */
export const evaluateConfidenceRoute = async (record: any): Promise<boolean> => {
  console.log(
    `[Validation Service] Rating confidence: OCR=${record.confidenceScore?.ocrOverall}, LLM=${record.confidenceScore?.llmOverall}`,
  );
  const CONFIDENCE_THRESHOLD = 0.85;
  return record.confidenceScore?.combined < CONFIDENCE_THRESHOLD;
};

export default {
  routeByConfidence,
  routeByConfidenceLegacy,
  evaluateConfidenceRoute,
};
